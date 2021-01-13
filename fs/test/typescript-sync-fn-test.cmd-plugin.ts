import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

export interface TestSyncPluginFunctionResult
  extends mod.DenoFunctionModuleHandlerResult {
  readonly pc: mod.PluginContext<modT.TestExecutive>;
}

export function testSyncPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
): TestSyncPluginFunctionResult {
  return { pc };
}

// publish the function so that the extension framework finds it
export default testSyncPluginFunction;
