import {
  colors,
  extn,
  govnSvcTelemetry as telem,
  path,
  safety,
  shell,
} from "./deps.ts";
import { testingAsserts as ta } from "../core/deps-test.ts";
import * as testGovn from "./test/governance.ts";
import * as mod from "./mod.ts";
import * as testStatic from "./test/static.ts";

declare global {
  interface Window {
    testPluginsManagerSingleton: extn.Singleton<TestCustomPluginsManager>;
    testPluginsManager: TestCustomPluginsManager;
  }
}

window.addEventListener("unload", async () => {
  await window.globalSingletons.destroy();
});

export class TestCustomPluginsManager extends extn.TypicalPluginsManager
  implements mod.FileSystemPluginsManager {
  readonly telemetry = new telem.Telemetry();
  readonly testModuleLocalFsPath = path.relative(
    Deno.cwd(),
    path.dirname(import.meta.url).substr("file://".length),
  );
  readonly dmfr = new mod.DenoModuleFileRegistrar<this>(
    this,
    this.telemetry,
  );
  readonly fileExtnsRegistrar: mod.FileSourcePluginRegistrar<this>;

  constructor() {
    super();
    this.fileExtnsRegistrar = new mod.FileSourcePluginRegistrar(
      this,
      (source) => {
        if (source.absPathAndFileName.endsWith(".ts")) {
          return this.dmfr;
        }
        return undefined;
      },
      new mod.ShellFileRegistrar(this),
    );
  }

  async init() {
    const fsrPlugins = new mod.FileSystemRoutesPlugins();
    await fsrPlugins.acquire([
      {
        registrars: [this.fileExtnsRegistrar],
        discoveryPath: path.join(this.testModuleLocalFsPath, "test"),
        globs: [{ glob: "**/*.plugin.*" }], // TODO: for each glob allow nature, etc. to be adjusted
      },
    ]);
    const staticPlugins = new extn.StaticPlugins(this.dmfr.denoModuleRegistrar);
    await staticPlugins.acquire({
      ...testStatic.custom.source,
      moduleEntryPoint: testStatic,
    });
    await this.activate({ pluginsAcquirers: [fsrPlugins, staticPlugins] });
  }

  pluginByAbbrevName<P extends extn.Plugin>(
    name: string,
    guard?: safety.TypeGuard<P>,
    expected?: string,
  ): P | undefined {
    return this.findPlugin(
      (p) => p.source.abbreviatedName == name,
      guard,
      () => {
        ta.assert(true, `Plugin '${name}' failed guard: ${expected}`);
      },
    );
  }

  denoFunctionPluginByAbbrevName(
    name: string,
  ): extn.DenoFunctionModulePlugin | undefined {
    return this.pluginByAbbrevName<extn.DenoFunctionModulePlugin>(
      name,
      extn.isDenoFunctionModulePlugin,
      "isDenoFunctionModulePlugin",
    );
  }

  denoScalarPluginByAbbrevName<T>(
    name: string,
  ): extn.DenoScalarModulePlugin<T> | undefined {
    return this.pluginByAbbrevName<extn.DenoScalarModulePlugin<T>>(
      name,
      extn.isDenoScalarModulePlugin,
      "isDenoScalarModulePlugin",
    );
  }

  denoModulePluginByAbbrevName(
    name: string,
  ): extn.DenoModulePlugin | undefined {
    return this.pluginByAbbrevName(
      name,
      extn.isDenoModulePlugin,
      "isDenoModulePlugin",
    );
  }
}

window.testPluginsManagerSingleton = extn.SingletonsManager.globalInstance()
  .singleton(
    async () => {
      const pm = new TestCustomPluginsManager();
      await pm.init();
      return pm;
    },
  );

window.testPluginsManager = await window.testPluginsManagerSingleton.value();

Deno.test(`CustomPluginsManager singleton is available`, () => {
  ta.assert(window.testPluginsManagerSingleton);
  ta.assert(window.testPluginsManager);
});

Deno.test(`CustomPluginsManager should not have any invalid plugins`, () => {
  const pluginsMgr = window.testPluginsManager;
  const invalidCount = pluginsMgr.invalidPlugins.length;
  if (invalidCount > 0) {
    console.log("\n==========================================================");
    console.log(`${invalidCount} Invalid Plugins (investigate why)`);
    console.log("==========================================================");
    for (const ip of pluginsMgr.invalidPlugins) {
      console.log(`${colors.yellow(ip.source.systemID)}`);
      console.log(ip.issues.flatMap((i) => i.diagnostics).join("\n"));
    }
    console.log("==========================================================");
  }
  ta.assertEquals(invalidCount, 0);
});

Deno.test(`CustomPluginsManager discovered proper number of plugins`, () => {
  const pluginsMgr = window.testPluginsManager;
  ta.assertEquals(pluginsMgr.invalidPlugins.length, 0);
  ta.assertEquals(pluginsMgr.plugins.length, 8);
});

Deno.test(`CustomPluginsManager shell plugins`, async () => {
  const pluginsMgr = window.testPluginsManager;
  const shellExePlugin = pluginsMgr.pluginByAbbrevName(
    "shell-exe-test.plugin.sh",
    extn.isShellExePlugin,
    "isShellExePlugin",
  );
  const shellCmdRegistrarOptions: extn.ShellExeActionOptions = {
    shellCmdEnhancer: (_sps, suggestedCmd): string[] => {
      const cmd = [...suggestedCmd];
      cmd.push("test_added_arg1");
      cmd.push("--test_added_arg2=value");
      return cmd;
    },
    runShellCmdOpts: (): shell.RunShellCommandOptions => {
      return shell.quietShellOutputOptions;
    },
    envVarsSupplier: (sps): Record<string, string> => {
      if (!mod.isDiscoverFileSystemPluginSource(sps.plugin.source)) {
        throw new Error(
          "pc.plugin.source must be DiscoverFileSystemPluginSource",
        );
      }
      const pluginHome = path.dirname(sps.plugin.source.absPathAndFileName);
      const result: Record<string, string> = {
        TEST_EXTN_HOME_ABS: pluginHome,
        TEST_EXTN_HOME_REL: path.relative(
          pluginsMgr.testModuleLocalFsPath,
          pluginHome,
        ),
        TEST_EXTN_NAME: path.basename(sps.plugin.source.absPathAndFileName),
      };
      return result;
    },
  };
  const result = await shellExePlugin?.execute({
    pluginsManager: pluginsMgr,
    telemetry: new extn.TypicalShellExeActionTelemetry(pluginsMgr.telemetry),
    options: shellCmdRegistrarOptions,
  });
  ta.assert(result, "shellExePlugin?.execute result should be available");
  ta.assert(
    shell.isExecutionResult(result.rscResult),
    "result.rscResult should be RunShellCommandExecResult",
  );
  ta.assertEquals(result.rscResult.stdErrOutput.length, 0);
  ta.assertEquals(
    `Hello World from shell executable plugin! (${
      result.rscResult.denoRunOpts.cmd[1]
    } ${result.rscResult.denoRunOpts.cmd[2]} ${result
      .rscResult.denoRunOpts.env?.TEST_EXTN_NAME})\n`,
    new TextDecoder().decode(result.rscResult.stdOut),
  );
});

Deno.test(`CustomPluginsManager Deno module plugins (TODO)`, () => {
  const pluginsMgr = window.testPluginsManager;

  // TODO [AE]: add tests for pluginsGraph dependency management
  // TODO: register depenedencies and test the graph
  // console.dir(pluginsMgr.pluginsGraph);

  const tsAsyncPlugin = pluginsMgr.denoFunctionPluginByAbbrevName(
    "async-fn-test.plugin.ts",
  );
  ta.assert(tsAsyncPlugin);
  ta.assert(tsAsyncPlugin.isAsync);
  ta.assertEquals(tsAsyncPlugin.isGenerator, false);

  const tsAsyncGenPlugin = pluginsMgr.denoFunctionPluginByAbbrevName(
    "async-gfn-test.plugin.ts",
  );
  ta.assert(tsAsyncGenPlugin);
  ta.assert(tsAsyncGenPlugin.isAsync);
  ta.assert(tsAsyncGenPlugin.isGenerator);

  const tsSyncPlugin = pluginsMgr.denoFunctionPluginByAbbrevName(
    "sync-fn-test.plugin.ts",
  );
  ta.assert(tsSyncPlugin);
  ta.assertEquals(
    "testSyncPluginFunction-graphNodeName",
    tsSyncPlugin.source.graphNodeName,
  );
  ta.assertEquals(tsSyncPlugin.isAsync, false);
  ta.assertEquals(tsSyncPlugin.isGenerator, false);

  const tsSyncGenPlugin = pluginsMgr.denoFunctionPluginByAbbrevName(
    "sync-gfn-test.plugin.ts",
  );
  ta.assert(tsSyncGenPlugin);
  ta.assertEquals(tsSyncGenPlugin.isAsync, false);
  ta.assert(tsSyncGenPlugin.isGenerator);

  ta.assert(pluginsMgr.denoModulePluginByAbbrevName("constructed"));
  ta.assert(pluginsMgr.denoModulePluginByAbbrevName("constructed dynamic"));
  ta.assert(pluginsMgr.denoModulePluginByAbbrevName("static"));
});

Deno.test(`CustomPluginsManager module activation and deactivation`, async () => {
  const pluginsMgr = window.testPluginsManager;

  const tsConstructedPlugin = pluginsMgr.denoModulePluginByAbbrevName(
    "constructed",
  );
  ta.assert(extn.isDenoModulePlugin(tsConstructedPlugin));
  ta.assert(testGovn.isTestState(tsConstructedPlugin));
  ta.assert(tsConstructedPlugin.activateCountState == 1);
  ta.assert(tsConstructedPlugin.deactivateCountState == 0);

  const tsDynamicPlugin = pluginsMgr.denoScalarPluginByAbbrevName<string>(
    "constructed dynamic",
  );
  ta.assert(extn.isDenoScalarModulePlugin(tsDynamicPlugin));
  ta.assertEquals(
    tsDynamicPlugin.scalar,
    "this is the default value, which can be different from the plugin",
  );
  ta.assert(testGovn.isTestState(tsDynamicPlugin));
  ta.assert(tsDynamicPlugin.activateCountState == 1);
  ta.assert(tsDynamicPlugin.deactivateCountState == 0);

  const staticPlugin = pluginsMgr.pluginByAbbrevName("static");
  ta.assert(extn.isDenoModulePlugin(staticPlugin));
  ta.assert(testGovn.isTestState(staticPlugin));
  ta.assert(staticPlugin.activateCountState == 1);
  ta.assert(staticPlugin.activateGraphCountState == 1);
  ta.assert(staticPlugin.deactivateCountState == 0);

  await pluginsMgr.deactivate({});
  ta.assert(tsConstructedPlugin.deactivateCountState > 0);
  ta.assert(tsConstructedPlugin.deactivateGraphCountState > 0);
  ta.assert(staticPlugin.deactivateCountState > 0);
  ta.assert(staticPlugin.deactivateGraphCountState > 0);
  ta.assert(tsDynamicPlugin.deactivateCountState > 0);
  ta.assert(tsDynamicPlugin.deactivateGraphCountState > 0);
});

Deno.test(`CustomPluginsManager plugins are graphed`, () => {
  const pluginsMgr = window.testPluginsManager;
  ta.assertEquals(pluginsMgr.pluginsGraph.overallTopNodes().length, 8);
});

Deno.test(`CustomPluginsManager plugins are instrumented`, () => {
  const pluginsMgr = window.testPluginsManager;
  ta.assertEquals(pluginsMgr.telemetry.instruments.length, 7);
});
