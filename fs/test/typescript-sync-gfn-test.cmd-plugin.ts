import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

export interface TestGenSyncPluginFunctionResult {
  readonly pc: mod.PluginContext<modT.TestExecutive>;
}

export function* testGenSyncPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
): Generator<TestGenSyncPluginFunctionResult, void, unknown> {
  yield { pc };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testGenSyncPluginFunction;
