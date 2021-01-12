import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

// deno-lint-ignore require-await
export async function testAsyncPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
): Promise<void> {
  console.log("Hello World from TypeScript testSyncPluginFunction");
}

// publish the function so that the extension framework finds it
export default testAsyncPluginFunction;
