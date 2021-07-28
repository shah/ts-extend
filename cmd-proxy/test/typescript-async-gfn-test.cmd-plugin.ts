import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export interface TestAsyncGenPluginFunctionResult {
  readonly context: mod.PluginContext<modT.TestExecutive>;
}

export async function* testAsyncGenPluginFunction(
  context: mod.PluginContext<modT.TestExecutive>,
): AsyncGenerator<mod.PluginContext<modT.TestExecutive>, void, unknown> {
  // just return the whole context, which shows we can do whatever we want
  yield context;
  return undefined;
}

// publish the function so that the extension framework finds it
export default testAsyncGenPluginFunction;
