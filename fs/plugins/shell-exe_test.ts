import {
  colors,
  extn,
  govnSvcTelemetry as telem,
  path,
  safety,
  shell,
} from "../deps.ts";
import { testingAsserts as ta } from "../deps-test.ts";
import * as mod from "../mod.ts";
import * as shp from "../../plugins/shell-exe.ts";
import * as shfsp from "./shell-exe.ts";

declare global {
  interface Window {
    shFstestPluginsManagerSingleton: extn.Singleton<
      TestShellExeFilesPluginsManager
    >;
    shFstestPluginsManager: TestShellExeFilesPluginsManager;
  }
}

window.addEventListener("unload", async () => {
  await window.globalSingletons.destroy();
});

export class TestShellExeFilesPluginsManager extends extn.TypicalPluginsManager
  implements mod.FileSystemPluginsManager {
  readonly telemetry = new telem.Telemetry();
  readonly testModuleLocalFsPath = path.relative(
    Deno.cwd(),
    path.dirname(import.meta.url).substr("file://".length),
  );
  readonly shellFileRegistrar = new shfsp.ShellFileRegistrar(this);

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
}

window.shFstestPluginsManagerSingleton = extn.SingletonsManager
  .globalInstance()
  .singleton(
    async () => {
      const pm = new TestShellExeFilesPluginsManager();
      const fsrPlugins = new mod.FileSystemRoutesPlugins();
      await fsrPlugins.acquire([
        {
          discoveryPath: path.join(pm.testModuleLocalFsPath, "..", "test"),
          globs: [{
            registrars: [pm.shellFileRegistrar],
            globID: "test-shell",
            glob: "**/*.plugin.sh",
          }],
        },
      ]);
      await pm.activate({ pluginsAcquirers: [fsrPlugins] });
      return pm;
    },
  );

window.shFstestPluginsManager = await window.shFstestPluginsManagerSingleton
  .value();

Deno.test(`TestShellExeFilesPluginsManager singleton is available`, () => {
  ta.assert(window.shFstestPluginsManagerSingleton);
  ta.assert(window.shFstestPluginsManager);
});

Deno.test(`TestShellExeFilesPluginsManager should not have any invalid plugins`, () => {
  const pluginsMgr = window.shFstestPluginsManager;
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

Deno.test(`TestShellExeFilesPluginsManager discovered proper number of plugins`, () => {
  const pluginsMgr = window.shFstestPluginsManager;
  ta.assertEquals(pluginsMgr.invalidPlugins.length, 0);
  ta.assertEquals(pluginsMgr.plugins.length, 1);
});

Deno.test(`TestShellExeFilesPluginsManager shell plugins`, async () => {
  const pluginsMgr = window.shFstestPluginsManager;
  const shellExePlugin = pluginsMgr.pluginByAbbrevName(
    "shell-exe-test.plugin.sh",
    shp.isShellExePlugin,
    "isShellExePlugin",
  );
  const shellCmdRegistrarOptions: shp.ShellExeActionOptions = {
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
    telemetry: new shp.TypicalShellExeActionTelemetry(pluginsMgr.telemetry),
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

Deno.test(`TestShellExeFilesPluginsManager plugins are graphed`, () => {
  const pluginsMgr = window.shFstestPluginsManager;
  ta.assertEquals(pluginsMgr.pluginsGraph.overallTopNodes().length, 1);
});

Deno.test(`TestShellExeFilesPluginsManager plugins are instrumented`, () => {
  const pluginsMgr = window.shFstestPluginsManager;
  ta.assertEquals(pluginsMgr.telemetry.instruments.length, 1);
});
