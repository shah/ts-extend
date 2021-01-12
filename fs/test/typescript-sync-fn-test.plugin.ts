import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

export function testSyncPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
): void {
  console.log("Hello World from TypeScript testSyncPluginFunction");
}

// publish the function so that the extension framework finds it
export default testSyncPluginFunction;
