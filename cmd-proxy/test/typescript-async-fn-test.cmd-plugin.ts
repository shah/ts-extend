import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export interface TestAsyncPluginFunctionResult {
  readonly context: mod.PluginContext<modT.TestExecutive>;
}

// publish the function so that the extension framework finds it
// deno-lint-ignore require-await
export default async function (
  context: mod.PluginContext<modT.TestExecutive>,
): Promise<TestAsyncPluginFunctionResult> {
  // just return the whole context, which shows we can do whatever we want
  return { context };
}
