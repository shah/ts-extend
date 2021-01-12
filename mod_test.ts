import { testingAsserts as ta } from "./deps-test.ts";
import * as mod from "./mod.ts";
import { path, shell } from "./deps.ts";

const testModuleLocalFsPath = path.relative(
  Deno.cwd(),
  path.dirname(import.meta.url).substr("file://".length),
);

export class TestExecutive implements mod.PluginExecutive {
}

export class TestContext implements mod.PluginContext<TestExecutive> {
  constructor(readonly container: TestExecutive, readonly plugin: mod.Plugin) {
  }

  onActivity(
    a: mod.PluginActivity,
    options?: { dryRun?: boolean },
  ): void {
    console.log(a.message, "dryRun:", options?.dryRun);
  }
}

export class TestPluginsManager implements mod.fs.FileSystemPluginsSupplier {
  readonly discoveryPath = path.join(testModuleLocalFsPath, "fs", "test");
  readonly plugins: mod.Plugin[] = [];
  readonly invalidPlugins: mod.InvalidPluginRegistration[] = [];
  readonly localFsSources: mod.fs.FileSystemGlobs;

  constructor() {
    this.localFsSources = ["**/*.*"];
  }

  async init(): Promise<void> {
    await mod.fs.discoverFileSystemPlugins({
      discoveryPath: this.discoveryPath,
      globs: this.localFsSources,
      onValidPlugin: (vpr) => {
        this.plugins.push(vpr.plugin);
      },
      onInvalidPlugin: (ipr) => {
        this.invalidPlugins.push(ipr);
      },
      shellFileRegistryOptions: {
        shellCmdEnhancer: (
          pc: mod.PluginContext<TestExecutive>,
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
          if (!mod.fs.isDiscoverFileSystemPluginSource(pc.plugin.source)) {
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
      },
      typeScriptFileRegistryOptions: {
        validateModule: mod.registerDenoFunctionModule,
      },
    });
  }
}

Deno.test(`File system plugins discovery`, async () => {
  const pluginsMgr = new TestPluginsManager();
  await pluginsMgr.init();
  ta.assertEquals(3, pluginsMgr.plugins.length);

  const shellExePlugin = pluginsMgr.plugins[0];
  ta.assert(mod.isShellExePlugin(shellExePlugin));

  const tsAsyncPlugin = pluginsMgr.plugins[1];
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncPlugin));
  ta.assert(tsAsyncPlugin.isAsync);

  const tsSyncPlugin = pluginsMgr.plugins[2];
  ta.assert(mod.isDenoFunctionModulePlugin(tsSyncPlugin));
  ta.assertEquals(false, tsSyncPlugin.isAsync);
});
