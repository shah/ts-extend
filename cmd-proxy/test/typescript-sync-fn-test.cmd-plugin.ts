import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export interface TestSyncPluginFunctionResult {
  readonly context: mod.PluginContext<modT.TestExecutive>;
}

export function testSyncPluginFunction(
  context: mod.PluginContext<modT.TestExecutive>,
): TestSyncPluginFunctionResult {
  return { context };
}

// publish the function so that the extension framework finds it
export default testSyncPluginFunction;
