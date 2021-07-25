import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

// exporting a const named graphNodeName will set source.graphNodeName
export const graphNodeName = "testSyncPluginFunction-graphNodeName";
export function testSyncPluginFunction(
  _pc: mod.PluginContext<modT.TestExecutive>,
): void {
  console.log("Hello World from TypeScript testSyncPluginFunction");
}

// publish the function so that the extension framework finds it
export default testSyncPluginFunction;
