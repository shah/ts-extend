import { cxg, govnSvcTelemetry as telem, path, shell } from "../deps.ts";
import { testingAsserts as ta } from "../deps-test.ts";
import * as mod from "../mod.ts";
import * as modFS from "./mod.ts";

const testModuleLocalFsPath = path.relative(
  Deno.cwd(),
  path.dirname(import.meta.url).substr("file://".length),
);

const testShellCmdRegistrarOptions: modFS.ShellFileRegistrarOptions<
  TestExecutive,
  mod.PluginContext<TestExecutive>
> = {
  shellCmdEnhancer: (
    _pc: mod.PluginContext<TestExecutive>,
    suggestedCmd: string[],
  ): string[] => {
    const cmd = [...suggestedCmd];
    cmd.push("test_added_arg1");
    cmd.push("--test_added_arg2=value");
    return cmd;
  },
  runShellCmdOpts: (): shell.RunShellCommandOptions => {
    return shell.cliVerboseShellOutputOptions;
  },
  envVarsSupplier: (
    pc: mod.PluginContext<TestExecutive>,
  ): Record<string, string> => {
    if (!modFS.isDiscoverFileSystemPluginSource(pc.plugin.source)) {
      throw new Error(
        "pc.plugin.source must be DiscoverFileSystemPluginSource",
      );
    }
    const pluginHome = path.dirname(pc.plugin.source.absPathAndFileName);
    const result: Record<string, string> = {
      TEST_EXTN_HOME_ABS: pluginHome,
      TEST_EXTN_HOME_REL: path.relative(
        testModuleLocalFsPath,
        pluginHome,
      ),
      TEST_EXTN_NAME: path.basename(pc.plugin.source.absPathAndFileName),
    };
    return result;
  },
  telemetry: new telem.Telemetry(),
};

export class TestExecutive {
}

export class TestContext implements mod.PluginContext<TestExecutive> {
  constructor(readonly container: TestExecutive, readonly plugin: mod.Plugin) {
  }
}

export class TestCustomPluginsManager
  implements modFS.FileSystemPluginsSupplier {
  readonly discoveryPath = path.join(testModuleLocalFsPath, "test");
  readonly plugins: mod.Plugin[] = [];
  readonly pluginsGraph: mod.PluginsGraph = new cxg.CxGraph();
  readonly invalidPlugins: mod.InvalidPluginRegistration[] = [];
  readonly localFsSources: modFS.FileSystemGlobs;
  readonly telemetry = new mod.TypicalTypeScriptRegistrarTelemetry();

  constructor(readonly executive: TestExecutive) {
    this.localFsSources = ["**/*.plugin.*"];
  }

  pluginByAbbrevName(name: string): mod.Plugin | undefined {
    return this.plugins.find((p) => p.source.abbreviatedName == name);
  }

  async init(): Promise<void> {
    await modFS.discoverFileSystemPlugins(this.executive, this, {
      discoveryPath: this.discoveryPath,
      globs: this.localFsSources,
      onValidPlugin: (vpr) => {
        this.plugins.push(vpr.plugin);
        vpr.plugin.registerNode(this.pluginsGraph);
      },
      onInvalidPlugin: (ipr) => {
        this.invalidPlugins.push(ipr);
      },
      shellFileRegistryOptions: testShellCmdRegistrarOptions,
      typeScriptFileRegistryOptions: {
        validateModule: mod.registerDenoFunctionModule,
        importModule: (source) => {
          return mod.importCachedModule(source, this.telemetry);
        },
        moduleMetaData: mod.moduleMetaData,
        telemetry: this.telemetry,
      },
    });
  }
}

Deno.test(`File system plugins discovery with custom plugins manager`, async () => {
  const executive = new TestExecutive();
  const pluginsMgr = new TestCustomPluginsManager(executive);
  await pluginsMgr.init();
  ta.assertEquals(6, pluginsMgr.plugins.length);

  // TODO: update as more telemetry is added, right now only TypeScript modules are instrumented
  ta.assertEquals(5, pluginsMgr.telemetry.instruments.length);

  // TODO: register depenedencies and test the graph
  // console.dir(pluginsMgr.pluginsGraph);

  const shellExePlugin = pluginsMgr.pluginByAbbrevName(
    "shell-exe-test.plugin.sh",
  );
  ta.assert(mod.isShellExePlugin(shellExePlugin));

  const tsAsyncPlugin = pluginsMgr.pluginByAbbrevName(
    "typescript-async-fn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncPlugin));
  if (mod.isDenoFunctionModulePlugin(tsAsyncPlugin)) {
    ta.assert(tsAsyncPlugin.isAsync);
    ta.assertEquals(false, tsAsyncPlugin.isGenerator);
  }

  const tsAsyncGenPlugin = pluginsMgr.pluginByAbbrevName(
    "typescript-async-gfn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncGenPlugin));
  if (mod.isDenoFunctionModulePlugin(tsAsyncGenPlugin)) {
    ta.assert(tsAsyncGenPlugin.isAsync);
    ta.assert(tsAsyncGenPlugin.isGenerator);
  }

  const tsSyncPlugin = pluginsMgr.pluginByAbbrevName(
    "typescript-sync-fn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsSyncPlugin));
  if (mod.isDenoFunctionModulePlugin(tsSyncPlugin)) {
    ta.assertEquals(
      tsSyncPlugin.source.graphNodeName,
      "testSyncPluginFunction-graphNodeName",
    );
    ta.assertEquals(false, tsSyncPlugin.isAsync);
    ta.assertEquals(false, tsSyncPlugin.isGenerator);
  }

  const tsSyncGenPlugin = pluginsMgr.pluginByAbbrevName(
    "typescript-sync-gfn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsSyncPlugin));
  if (mod.isDenoFunctionModulePlugin(tsSyncGenPlugin)) {
    ta.assertEquals(false, tsSyncGenPlugin.isAsync);
    ta.assert(tsSyncGenPlugin.isGenerator);
  }

  const tsConstructedPlugin = pluginsMgr.pluginByAbbrevName("constructed");
  ta.assert(mod.isDenoModulePlugin(tsConstructedPlugin));
  ta.assert("activateCountState" in tsConstructedPlugin);
  ta.assert("executeCountState" in tsConstructedPlugin);
});
