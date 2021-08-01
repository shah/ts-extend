import {
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
  readonly telemetry = new extn.TypicalTypeScriptRegistrarTelemetry();
  readonly testModuleLocalFsPath = path.relative(
    Deno.cwd(),
    path.dirname(import.meta.url).substr("file://".length),
  );

  readonly typescriptRegistrarOptions: extn.TypeScriptRegistrarOptions<this> = {
    validateModule: extn.registerDenoFunctionModule,
    importModule: (source) => {
      return extn.importCachedModule(source, this.telemetry);
    },
    moduleMetaData: extn.moduleMetaData,
    activate: extn.typicalDenoModuleActivate,
    telemetry: this.telemetry,
  };
  readonly tsFileRegistrar = new mod.TypeScriptFileRegistrar(
    this,
    this.typescriptRegistrarOptions,
  );
  readonly fileExtnsRegistrar: mod.FileSourcePluginRegistrar<this>;

  constructor() {
    super();
    this.fileExtnsRegistrar = new mod.FileSourcePluginRegistrar(
      this,
      (source) => {
        if (source.absPathAndFileName.endsWith(".ts")) {
          return this.tsFileRegistrar;
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
    const staticPlugins = new extn.StaticPlugins(
      this,
      this.typescriptRegistrarOptions,
    );
    await staticPlugins.acquire(testStatic.custom, testStatic);
    await this.activate({ pluginsAcquirers: [fsrPlugins, staticPlugins] });
  }

  pluginByAbbrevName<P extends extn.Plugin>(
    name: string,
    guard?: safety.TypeGuard<P>,
    expected?: string,
  ): P | undefined {
    const plugin = this.plugins.find((p) => p.source.abbreviatedName == name);
    if (plugin && guard) {
      ta.assert(
        guard(plugin),
        `Plugin '${name}' failed guard: ${expected}`,
      );
      return plugin;
    } else if (plugin) {
      return plugin as P;
    }
    return undefined;
  }

  denoFunctionPluginByAbbrevName(
    name: string,
  ): extn.DenoFunctionModulePlugin<this> | undefined {
    return this.pluginByAbbrevName<extn.DenoFunctionModulePlugin<this>>(
      name,
      extn.isDenoFunctionModulePlugin,
      "isDenoFunctionModulePlugin",
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

Deno.test(`CustomPluginsManager discovered proper number of plugins`, () => {
  const pluginsMgr = window.testPluginsManager;
  ta.assertEquals(7, pluginsMgr.plugins.length);
});

Deno.test(`CustomPluginsManager plugins are instrumented (TODO)`, () => {
  const pluginsMgr = window.testPluginsManager;

  // TODO: update as more telemetry is added, right now only TypeScript modules are instrumented
  ta.assertEquals(5, pluginsMgr.telemetry.instruments.length);
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
    telemetry: new telem.Telemetry(),
  };
  const result = await shellExePlugin?.execute({
    pluginsManager: pluginsMgr,
    options: shellCmdRegistrarOptions,
  });
  ta.assert(result, "shellExePlugin?.execute result should be available");
  ta.assert(
    shell.isExecutionResult(result.rscResult),
    "result.rscResult should be RunShellCommandExecResult",
  );
  ta.assertEquals(0, result.rscResult.stdErrOutput.length);
  ta.assertEquals(
    new TextDecoder().decode(result.rscResult.stdOut),
    `Hello World from shell executable plugin! (${
      result.rscResult.denoRunOpts.cmd[1]
    } ${result.rscResult.denoRunOpts.cmd[2]} ${result
      .rscResult.denoRunOpts.env?.TEST_EXTN_NAME})\n`,
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
  ta.assertEquals(false, tsAsyncPlugin.isGenerator);

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
    tsSyncPlugin.source.graphNodeName,
    "testSyncPluginFunction-graphNodeName",
  );
  ta.assertEquals(false, tsSyncPlugin.isAsync);
  ta.assertEquals(false, tsSyncPlugin.isGenerator);

  const tsSyncGenPlugin = pluginsMgr.denoFunctionPluginByAbbrevName(
    "sync-gfn-test.plugin.ts",
  );
  ta.assert(tsSyncGenPlugin);
  ta.assertEquals(false, tsSyncGenPlugin.isAsync);
  ta.assert(tsSyncGenPlugin.isGenerator);

  ta.assert(pluginsMgr.denoModulePluginByAbbrevName("constructed"));
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

  const staticPlugin = pluginsMgr.pluginByAbbrevName("static");
  ta.assert(extn.isDenoModulePlugin(staticPlugin));
  ta.assert(testGovn.isTestState(staticPlugin));
  ta.assert(staticPlugin.activateCountState == 1);
  ta.assert(staticPlugin.deactivateCountState == 0);

  await pluginsMgr.deactivate();
  ta.assert(staticPlugin.deactivateCountState > 0);
  ta.assert(tsConstructedPlugin.deactivateCountState > 0);
});
