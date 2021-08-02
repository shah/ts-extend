import {
  colors,
  extn,
  govnSvcTelemetry as telem,
  path,
  safety,
} from "../deps.ts";
import { testingAsserts as ta } from "../deps-test.ts";
import * as testGovn from "../test/governance.ts";
import * as mod from "../mod.ts";
import * as dp from "../../plugins/module.ts";
import * as dfsp from "./module.ts";
import * as testStatic from "../test/static.ts";

declare global {
  interface Window {
    denoFsTestPluginsManagerSingleton: extn.Singleton<
      TestDenoFilesPluginsManager
    >;
    denoFsTestPluginsManager: TestDenoFilesPluginsManager;
  }
}

window.addEventListener("unload", async () => {
  await window.globalSingletons.destroy();
});

export class TestDenoFilesPluginsManager extends extn.TypicalPluginsManager
  implements mod.FileSystemPluginsManager {
  readonly telemetry = new telem.Telemetry();
  readonly testModuleLocalFsPath = path.relative(
    Deno.cwd(),
    path.dirname(import.meta.url).substr("file://".length),
  );
  readonly dmfr = new dfsp.DenoModuleFileRegistrar<this>(
    this,
    this.telemetry,
  );

  async init() {
    const fsrPlugins = new mod.FileSystemRoutesPlugins();
    await fsrPlugins.acquire([
      {
        discoveryPath: path.join(this.testModuleLocalFsPath, "..", "test"),
        globs: [{
          registrars: [this.dmfr],
          globID: "test-deno",
          glob: "**/*.plugin.{js,ts}",
        }],
      },
    ]);
    const staticPlugins = new dp.StaticPlugins(
      this.dmfr.denoModuleRegistrar,
    );
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
  ): dp.DenoFunctionModulePlugin | undefined {
    return this.pluginByAbbrevName<dp.DenoFunctionModulePlugin>(
      name,
      dp.isDenoFunctionModulePlugin,
      "isDenoFunctionModulePlugin",
    );
  }

  denoScalarPluginByAbbrevName<T>(
    name: string,
  ): dp.DenoScalarModulePlugin<T> | undefined {
    return this.pluginByAbbrevName<dp.DenoScalarModulePlugin<T>>(
      name,
      dp.isDenoScalarModulePlugin,
      "isDenoScalarModulePlugin",
    );
  }

  denoModulePluginByAbbrevName(
    name: string,
  ): dp.DenoModulePlugin | undefined {
    return this.pluginByAbbrevName(
      name,
      dp.isDenoModulePlugin,
      "isDenoModulePlugin",
    );
  }
}

window.denoFsTestPluginsManagerSingleton = extn.SingletonsManager
  .globalInstance()
  .singleton(
    async () => {
      const pm = new TestDenoFilesPluginsManager();
      await pm.init();
      return pm;
    },
  );

window.denoFsTestPluginsManager = await window.denoFsTestPluginsManagerSingleton
  .value();

Deno.test(`TestDenoFilesPluginsManager singleton is available`, () => {
  ta.assert(window.denoFsTestPluginsManagerSingleton);
  ta.assert(window.denoFsTestPluginsManager);
});

Deno.test(`TestDenoFilesPluginsManager should not have any invalid plugins`, () => {
  const pluginsMgr = window.denoFsTestPluginsManager;
  const invalidCount = pluginsMgr.invalidPlugins.length;
  if (invalidCount > 0) {
    console.log("\n==========================================================");
    console.log(`${invalidCount} Invalid Plugins (investigate why)`);
    console.log("==========================================================");
    for (const ip of pluginsMgr.invalidPlugins) {
      console.log(
        `${colors.green(ip.source.registrarID)} ${
          colors.yellow(ip.source.systemID)
        }`,
      );
      console.log(ip.issues.flatMap((i) => i.diagnostics).join("\n"));
    }
    console.log("==========================================================");
  }
  ta.assertEquals(invalidCount, 0);
});

Deno.test(`TestDenoFilesPluginsManager discovered proper number of plugins`, () => {
  const pluginsMgr = window.denoFsTestPluginsManager;
  ta.assertEquals(pluginsMgr.invalidPlugins.length, 0);
  ta.assertEquals(pluginsMgr.plugins.length, 7);
});

Deno.test(`TestDenoFilesPluginsManager Deno module plugins (TODO)`, () => {
  const pluginsMgr = window.denoFsTestPluginsManager;

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

Deno.test(`TestDenoFilesPluginsManager module activation and deactivation`, async () => {
  const pluginsMgr = window.denoFsTestPluginsManager;

  const tsConstructedPlugin = pluginsMgr.denoModulePluginByAbbrevName(
    "constructed",
  );
  ta.assert(dp.isDenoModulePlugin(tsConstructedPlugin));
  ta.assert(testGovn.isTestState(tsConstructedPlugin));
  ta.assert(tsConstructedPlugin.activateCountState == 1);
  ta.assert(tsConstructedPlugin.deactivateCountState == 0);

  const tsDynamicPlugin = pluginsMgr.denoScalarPluginByAbbrevName<string>(
    "constructed dynamic",
  );
  ta.assert(dp.isDenoScalarModulePlugin(tsDynamicPlugin));
  ta.assertEquals(
    tsDynamicPlugin.scalar,
    "this is the default value, which can be different from the plugin",
  );
  ta.assert(testGovn.isTestState(tsDynamicPlugin));
  ta.assert(tsDynamicPlugin.activateCountState == 1);
  ta.assert(tsDynamicPlugin.deactivateCountState == 0);

  const staticPlugin = pluginsMgr.pluginByAbbrevName("static");
  ta.assert(dp.isDenoModulePlugin(staticPlugin));
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

Deno.test(`TestDenoFilesPluginsManager plugins are graphed`, () => {
  const pluginsMgr = window.denoFsTestPluginsManager;
  ta.assertEquals(pluginsMgr.pluginsGraph.overallTopNodes().length, 7);
});

Deno.test(`TestDenoFilesPluginsManager plugins are instrumented`, () => {
  const pluginsMgr = window.denoFsTestPluginsManager;
  ta.assertEquals(pluginsMgr.telemetry.instruments.length, 6);
});
