import { colors, extn, govnSvcTelemetry as telem, path } from "./deps.ts";
import { testingAsserts as ta } from "../core/deps-test.ts";
import * as mod from "./mod.ts";
import * as dp from "../plugins/module.ts";
import * as dfsp from "./plugins/module.ts";
import * as shfsp from "./plugins/shell-exe.ts";
import * as testStatic from "./test/static.ts";

declare global {
  interface Window {
    testPluginsManagerSingleton: extn.Singleton<
      TestMultipleFilesPluginsManager
    >;
    testPluginsManager: TestMultipleFilesPluginsManager;
  }
}

window.addEventListener("unload", async () => {
  await window.globalSingletons.destroy();
});

export class TestMultipleFilesPluginsManager extends extn.TypicalPluginsManager
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
      new shfsp.ShellFileRegistrar(this),
    );
  }

  async init() {
    const fsrPlugins = new mod.FileSystemRoutesPlugins();
    await fsrPlugins.acquire([
      {
        registrars: [this.fileExtnsRegistrar],
        discoveryPath: path.join(this.testModuleLocalFsPath, "test"),
        globs: [{ registrarID: "test-multiple-*", glob: "**/*.plugin.*" }], // TODO: for each glob allow nature, etc. to be adjusted
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
}

window.testPluginsManagerSingleton = extn.SingletonsManager.globalInstance()
  .singleton(
    async () => {
      const pm = new TestMultipleFilesPluginsManager();
      await pm.init();
      return pm;
    },
  );

window.testPluginsManager = await window.testPluginsManagerSingleton.value();

Deno.test(`TestMultipleFilesPluginsManager singleton is available`, () => {
  ta.assert(window.testPluginsManagerSingleton);
  ta.assert(window.testPluginsManager);
});

Deno.test(`TestMultipleFilesPluginsManager should not have any invalid plugins`, () => {
  const pluginsMgr = window.testPluginsManager;
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

Deno.test(`TestMultipleFilesPluginsManager discovered proper number of plugins`, () => {
  const pluginsMgr = window.testPluginsManager;
  ta.assertEquals(pluginsMgr.invalidPlugins.length, 0);
  ta.assertEquals(pluginsMgr.plugins.length, 8);
});
