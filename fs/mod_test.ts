import { cxg, govnSvcTelemetry as telem, path, shell } from "../deps.ts";
import { testingAsserts as ta } from "../deps-test.ts";
import * as testGovn from "./test/governance.ts";
import * as mod from "../mod.ts";
import * as modFS from "./mod.ts";
import * as testStatic from "./test/static.ts";

window.addEventListener("unload", async () => {
  await window.globalSingletons.destroy();
});

// TODO [AE]: add tests for pluginsGraph dependency management

const testModuleLocalFsPath = path.relative(
  Deno.cwd(),
  path.dirname(import.meta.url).substr("file://".length),
);

const testShellCmdRegistrarOptions: modFS.ShellFileRegistrarOptions<
  TestExecutive
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
  readonly isPluginExecutive = true;
}

export class TestContext implements mod.PluginContext<TestExecutive> {
  constructor(readonly container: TestExecutive, readonly plugin: mod.Plugin) {
  }
}

export class TestCustomPluginsManager
  implements modFS.FileSystemPluginsSupplier<TestExecutive> {
  readonly discoveryPath = path.join(testModuleLocalFsPath, "test");
  readonly plugins: mod.Plugin[] = [];
  readonly pluginsGraph: mod.PluginsGraph = new cxg.CxGraph();
  readonly validInactivePlugins: mod.ValidPluginRegistration[] = [];
  readonly invalidPlugins: mod.InvalidPluginRegistration[] = [];
  readonly localFsSources: modFS.FileSystemGlobs;
  readonly telemetry = new mod.TypicalTypeScriptRegistrarTelemetry();

  constructor(readonly executive: TestExecutive) {
    this.localFsSources = ["**/*.plugin.*"];
  }

  pluginByAbbrevName(name: string): mod.Plugin | undefined {
    return this.plugins.find((p) => p.source.abbreviatedName == name);
  }

  protected async init(): Promise<void> {
    const dfspo: modFS.DiscoverFileSystemPluginsOptions<TestExecutive> = {
      discoveryPath: this.discoveryPath,
      globs: this.localFsSources,
      onValidPlugin: (vpr) => {
        this.validInactivePlugins.push(vpr);
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
        activate: mod.typicalDenoModuleActivate,
        telemetry: this.telemetry,
      },
    };
    const staticModule = await mod.registerDenoFunctionModule(
      this.executive,
      this,
      { ...testStatic.custom, module: testStatic },
      dfspo.typeScriptFileRegistryOptions.moduleMetaData(testStatic),
    );
    if (mod.isValidPluginRegistration(staticModule)) {
      dfspo.onValidPlugin(staticModule);
    }
    await modFS.discoverFileSystemPlugins(this.executive, this, dfspo);
  }

  async activate(): Promise<void> {
    await this.init();
    for (const vpr of this.validInactivePlugins) {
      const ac: mod.ActivateContext<
        TestExecutive,
        mod.PluginContext<TestExecutive>,
        this
      > = {
        context: { container: this.executive, plugin: vpr.plugin },
        supplier: this,
        vpr,
      };
      if (mod.isActivatablePlugin(ac.vpr.plugin)) {
        (ac.vpr.plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Activating;
        const activatedPR = await ac.vpr.plugin.activate(ac);
        if (mod.isValidPluginRegistration(activatedPR.registration)) {
          this.plugins.push(ac.vpr.plugin);
        } else {
          this.invalidPlugins.push(activatedPR.registration);
        }
        (ac.vpr.plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Active;
      } else if (mod.isActivatableSyncPlugin(ac.vpr.plugin)) {
        (ac.vpr.plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Activating;
        const activatedPR = ac.vpr.plugin.activateSync(ac);
        if (mod.isValidPluginRegistration(activatedPR.registration)) {
          this.plugins.push(ac.vpr.plugin);
        } else {
          this.invalidPlugins.push(activatedPR.registration);
        }
        (ac.vpr.plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Active;
      } else {
        // not a typescript module or no activation hook requested, no special activation
        this.plugins.push(ac.vpr.plugin);
      }
    }
  }

  async deactivate(): Promise<void> {
    for (const plugin of this.plugins) {
      const dac: mod.DeactivateContext<
        TestExecutive,
        mod.PluginContext<TestExecutive>,
        this
      > = {
        context: { container: this.executive, plugin },
        supplier: this,
      };
      if (mod.isActivatablePlugin(plugin)) {
        (plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Deactivating;
        await plugin.deactivate(dac);
        (plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Inactive;
      } else if (mod.isActivatableSyncPlugin(plugin)) {
        (plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Activating;
        plugin.deactivateSync(dac);
        (plugin.activationState as mod.PluginActivationState) =
          mod.PluginActivationState.Inactive;
      }
    }
  }
}

Deno.test(`File system plugins discovery with custom plugins manager`, async () => {
  const executive = new TestExecutive();
  const pluginsMgr = new TestCustomPluginsManager(executive);
  await pluginsMgr.activate();
  ta.assertEquals(7, pluginsMgr.plugins.length);

  // TODO: update as more telemetry is added, right now only TypeScript modules are instrumented
  ta.assertEquals(5, pluginsMgr.telemetry.instruments.length);

  // TODO: register depenedencies and test the graph
  // console.dir(pluginsMgr.pluginsGraph);

  const shellExePlugin = pluginsMgr.pluginByAbbrevName(
    "shell-exe-test.plugin.sh",
  );
  ta.assert(mod.isShellExePlugin(shellExePlugin));

  const tsAsyncPlugin = pluginsMgr.pluginByAbbrevName(
    "async-fn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncPlugin));
  if (mod.isDenoFunctionModulePlugin(tsAsyncPlugin)) {
    ta.assert(tsAsyncPlugin.isAsync);
    ta.assertEquals(false, tsAsyncPlugin.isGenerator);
  }

  const tsAsyncGenPlugin = pluginsMgr.pluginByAbbrevName(
    "async-gfn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncGenPlugin));
  if (mod.isDenoFunctionModulePlugin(tsAsyncGenPlugin)) {
    ta.assert(tsAsyncGenPlugin.isAsync);
    ta.assert(tsAsyncGenPlugin.isGenerator);
  }

  const tsSyncPlugin = pluginsMgr.pluginByAbbrevName(
    "sync-fn-test.plugin.ts",
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
    "sync-gfn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsSyncPlugin));
  if (mod.isDenoFunctionModulePlugin(tsSyncGenPlugin)) {
    ta.assertEquals(false, tsSyncGenPlugin.isAsync);
    ta.assert(tsSyncGenPlugin.isGenerator);
  }

  const tsConstructedPlugin = pluginsMgr.pluginByAbbrevName("constructed");
  ta.assert(mod.isDenoModulePlugin(tsConstructedPlugin));
  ta.assert(testGovn.isTestState(tsConstructedPlugin));
  ta.assert(tsConstructedPlugin.activateCountState == 1);
  ta.assert(tsConstructedPlugin.deactivateCountState == 0);

  const staticPlugin = pluginsMgr.pluginByAbbrevName("static");
  ta.assert(mod.isDenoModulePlugin(staticPlugin));
  ta.assert(testGovn.isTestState(staticPlugin));
  ta.assert(staticPlugin.activateCountState == 1);
  ta.assert(staticPlugin.deactivateCountState == 0);

  await pluginsMgr.deactivate();
  ta.assert(staticPlugin.deactivateCountState > 0);
  ta.assert(tsConstructedPlugin.deactivateCountState > 0);
});
