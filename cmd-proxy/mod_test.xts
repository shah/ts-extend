import { path, shell } from "../deps.ts";
import { testingAsserts as ta } from "../deps-test.ts";
import * as extn from "../mod.ts";
import * as cp from "./mod.ts";
import * as testGovn from "./test/governance.ts";

window.addEventListener("unload", async () => {
  await window.globalSingletons.destroy();
});

const testModuleLocalFsPath = path.relative(
  Deno.cwd(),
  path.dirname(import.meta.url).substr("file://".length),
);

export class TestExecutive {
  readonly isPluginExecutive = true;
}

export class TestContext implements extn.PluginContext<TestExecutive> {
  constructor(readonly container: TestExecutive, readonly plugin: extn.Plugin) {
  }

  onActivity(
    a: cp.CommandProxyPluginActivity,
    options?: { readonly dryRun?: boolean },
  ): void {
    console.log(a.message, "dryRun:", options?.dryRun);
  }
}

Deno.test(`File system plugins discovery with commands proxy plugins manager`, async () => {
  const describeCmd: cp.ProxyableCommand = { proxyCmd: "describe" };
  const pluginsMgr = new cp.CommandProxyFileSystemPluginsManager(
    new TestExecutive(),
    {
      [describeCmd.proxyCmd]: describeCmd,
    },
    {
      discoveryPath: path.join(testModuleLocalFsPath, "test"),
      localFsSources: ["**/*.cmd-plugin.*"],
      shellCmdPrepareRunOpts: (): shell.RunShellCommandOptions => {
        // usually we want output to go to the console but we're overriding it
        // in the test case so that we don't show anything but we can test it
        // with asserts
        return {};
      },
    },
  );
  await pluginsMgr.activate();
  const pluginByAbbrevName = (name: string): extn.Plugin | undefined => {
    return pluginsMgr.plugins.find((p) => p.source.abbreviatedName == name);
  };

  ta.assertEquals(6, pluginsMgr.plugins.length);

  // TODO: register depenedencies and test the graph
  // console.dir(pluginsMgr.pluginsGraph);

  const shellExePlugin = pluginByAbbrevName(
    "shell-exe-test.cmd-plugin.sh",
  );
  ta.assert(extn.isShellExePlugin(shellExePlugin));

  const tsAsyncPlugin = pluginByAbbrevName(
    "async-fn-test.cmd-plugin.ts",
  );
  ta.assert(extn.isDenoFunctionModulePlugin(tsAsyncPlugin));
  if (extn.isDenoFunctionModulePlugin(tsAsyncPlugin)) {
    ta.assert(tsAsyncPlugin.isAsync);
    ta.assertEquals(false, tsAsyncPlugin.isGenerator);
  }

  const tsAsyncGenPlugin = pluginByAbbrevName(
    "async-gfn-test.cmd-plugin.ts",
  );
  ta.assert(extn.isDenoFunctionModulePlugin(tsAsyncGenPlugin));
  if (extn.isDenoFunctionModulePlugin(tsAsyncGenPlugin)) {
    ta.assert(tsAsyncGenPlugin.isAsync);
    ta.assert(tsAsyncGenPlugin.isGenerator);
  }

  const tsSyncPlugin = pluginByAbbrevName(
    "sync-fn-test.cmd-plugin.ts",
  );
  ta.assert(extn.isDenoFunctionModulePlugin(tsSyncPlugin));
  if (extn.isDenoFunctionModulePlugin(tsSyncPlugin)) {
    ta.assertEquals(false, tsSyncPlugin.isAsync);
    ta.assertEquals(false, tsSyncPlugin.isGenerator);
  }

  const tsSyncGenPlugin = pluginByAbbrevName(
    "sync-gfn-test.cmd-plugin.ts",
  );
  ta.assert(extn.isDenoFunctionModulePlugin(tsSyncGenPlugin));
  if (extn.isDenoFunctionModulePlugin(tsSyncGenPlugin)) {
    ta.assertEquals(false, tsSyncGenPlugin.isAsync);
    ta.assert(tsSyncGenPlugin.isGenerator);
  }

  const tsConstructedPlugin = pluginByAbbrevName("constructed");
  ta.assert(extn.isDenoModulePlugin(tsConstructedPlugin));

  let unhandledCount = 0;
  const results = await pluginsMgr.execute(describeCmd, {
    onUnhandledPlugin: (cppc) => {
      unhandledCount++;
      console.error("UNABLE TO EXECUTE");
      console.dir(cppc);
    },
  });
  ta.assertEquals(0, unhandledCount);
  ta.assertEquals(6, results.length);

  ta.assert(testGovn.isTestState(tsConstructedPlugin));
  ta.assert(tsConstructedPlugin.activateCountState == 1);
  ta.assert(tsConstructedPlugin.executeCountState > 0);

  results.forEach((r) => {
    if (extn.isShellExeActionResult(r)) {
      if (shell.isExecutionResult(r.rscResult)) {
        const expected =
          "Describe what will be generated in 'test.auto.md' in '.' by shell-exe-test.cmd-plugin.sh\n";
        const output = new TextDecoder().decode(
          r.rscResult.stdOut,
        );
        ta.assertEquals(output, expected);
      }
    }
  });
});
