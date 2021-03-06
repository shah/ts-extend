import { testingAsserts as ta } from "./deps-test.ts";
import * as mod from "./mod.ts";
import { path, shell } from "./deps.ts";
import { assert } from "https://deno.land/std@0.83.0/_util/assert.ts";
import { assertEquals } from "https://deno.land/std@0.83.0/testing/asserts.ts";

const testModuleLocalFsPath = path.relative(
  Deno.cwd(),
  path.dirname(import.meta.url).substr("file://".length),
);

const testShellCmdRegistrarOptions: mod.fs.ShellFileRegistrarOptions<
  TestExecutive
> = {
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
};

export class TestExecutive implements mod.PluginExecutive {
}

export class TestContext implements mod.PluginContext<TestExecutive> {
  constructor(readonly container: TestExecutive, readonly plugin: mod.Plugin) {
  }

  onActivity(a: mod.PluginActivity, options?: { dryRun?: boolean }): void {
    console.log(a.message, "dryRun:", options?.dryRun);
  }
}

export class TestCustomPluginsManager
  implements mod.fs.FileSystemPluginsSupplier {
  readonly discoveryPath = path.join(testModuleLocalFsPath, "fs", "test");
  readonly plugins: mod.Plugin[] = [];
  readonly invalidPlugins: mod.InvalidPluginRegistration[] = [];
  readonly localFsSources: mod.fs.FileSystemGlobs;

  constructor() {
    this.localFsSources = ["**/*.plugin.*"];
  }

  pluginByAbbrevName(name: string): mod.Plugin | undefined {
    return this.plugins.find((p) => p.source.abbreviatedName == name);
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
      shellFileRegistryOptions: testShellCmdRegistrarOptions,
      typeScriptFileRegistryOptions: {
        validateModule: mod.registerDenoFunctionModule,
        importModule: mod.importCachedModule,
      },
    });
  }
}

Deno.test(`File system plugins discovery with custom plugins manager`, async () => {
  const pluginsMgr = new TestCustomPluginsManager();
  await pluginsMgr.init();
  ta.assertEquals(4, pluginsMgr.plugins.length);

  const shellExePlugin = pluginsMgr.pluginByAbbrevName(
    "shell-exe-test.plugin.sh",
  );
  ta.assert(mod.isShellExePlugin(shellExePlugin));

  const tsAsyncPlugin = pluginsMgr.pluginByAbbrevName(
    "typescript-async-fn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncPlugin));
  ta.assert(tsAsyncPlugin.isAsync);

  const tsSyncPlugin = pluginsMgr.pluginByAbbrevName(
    "typescript-sync-fn-test.plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsSyncPlugin));
  ta.assertEquals(false, tsSyncPlugin.isAsync);

  const tsConstructedPlugin = pluginsMgr.pluginByAbbrevName("constructed");
  ta.assert(mod.isDenoModulePlugin(tsConstructedPlugin));
});

Deno.test(`File system plugins discovery with commands proxy plugins manager`, async () => {
  const describeCmd: mod.ProxyableCommand = { proxyCmd: "describe" };
  const pluginsMgr = new mod.fs.CommandProxyFileSystemPluginsManager(
    new TestExecutive(),
    {
      [describeCmd.proxyCmd]: describeCmd,
    },
    {
      discoveryPath: path.join(testModuleLocalFsPath, "fs", "test"),
      localFsSources: ["**/*.cmd-plugin.*"],
      shellCmdPrepareRunOpts: (): shell.RunShellCommandOptions => {
        // usually we want output to go to the console but we're overriding it
        // in the test case so that we don't show anything but we can test it
        // with asserts
        return {};
      },
    },
  );
  await pluginsMgr.init();
  const pluginByAbbrevName = (name: string): mod.Plugin | undefined => {
    return pluginsMgr.plugins.find((p) => p.source.abbreviatedName == name);
  };

  ta.assertEquals(4, pluginsMgr.plugins.length);

  const shellExePlugin = pluginByAbbrevName(
    "shell-exe-test.cmd-plugin.sh",
  );
  ta.assert(mod.isShellExePlugin(shellExePlugin));

  const tsAsyncPlugin = pluginByAbbrevName(
    "typescript-async-fn-test.cmd-plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsAsyncPlugin));
  ta.assert(tsAsyncPlugin.isAsync);

  const tsSyncPlugin = pluginByAbbrevName(
    "typescript-sync-fn-test.cmd-plugin.ts",
  );
  ta.assert(mod.isDenoFunctionModulePlugin(tsSyncPlugin));
  ta.assertEquals(false, tsSyncPlugin.isAsync);

  const tsConstructedPlugin = pluginByAbbrevName("constructed");
  ta.assert(mod.isDenoModulePlugin(tsConstructedPlugin));

  let unhandledCount = 0;
  const results = await pluginsMgr.execute(describeCmd, {
    onUnhandledPlugin: (cppc) => {
      unhandledCount++;
      console.error("UNABLE TO EXECUTE");
      console.dir(cppc);
    },
  });
  ta.assertEquals(0, unhandledCount);
  ta.assertEquals(4, results.length);

  results.forEach((r) => {
    if (mod.isShellExeActionResult(r)) {
      if (shell.isExecutionResult(r.rscResult)) {
        const expected =
          "Describe what will be generated in 'test.auto.md' in '.' by shell-exe-test.cmd-plugin.sh\n";
        const output = new TextDecoder().decode(
          r.rscResult.stdOut,
        );
        assertEquals(output, expected);
      }
    }
  });
});
