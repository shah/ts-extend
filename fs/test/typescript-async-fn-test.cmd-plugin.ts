import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

export interface TestAsyncPluginFunctionResult
  extends mod.DenoFunctionModuleHandlerResult {
  readonly pc: mod.PluginContext<modT.TestExecutive>;
}

// deno-lint-ignore require-await
export async function testAsyncPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
): Promise<TestAsyncPluginFunctionResult> {
  // just return the whole context, which shows we can do whatever we want
  return { pc };
}

// publish the function so that the extension framework finds it
export default testAsyncPluginFunction;
