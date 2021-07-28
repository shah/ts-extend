import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

export interface TestGenSyncPluginFunctionResult {
  readonly context: mod.PluginContext<modT.TestExecutive>;
}

export function* testGenSyncPluginFunction(
  context: mod.PluginContext<modT.TestExecutive>,
): Generator<TestGenSyncPluginFunctionResult, void, unknown> {
  yield { context };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testGenSyncPluginFunction;
