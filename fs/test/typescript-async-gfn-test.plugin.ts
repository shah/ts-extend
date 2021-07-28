import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export async function* testAsyncGeneratorPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
): AsyncGenerator<mod.PluginContext<modT.TestExecutive>, undefined, unknown> {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  yield pc;
  return undefined;
}

// publish the function so that the extension framework finds it
export default testAsyncGeneratorPluginFunction;
