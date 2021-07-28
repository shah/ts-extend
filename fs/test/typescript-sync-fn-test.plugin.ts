import * as govn from "./governance.ts";

// exporting a const named graphNodeName will set source.graphNodeName
export const graphNodeName = "testSyncPluginFunction-graphNodeName";
export function testSyncPluginFunction(
  context: govn.TestPluginContext,
): govn.TestPluginActionResult {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  return { context };
}

// publish the function so that the extension framework finds it
export default testSyncPluginFunction;
