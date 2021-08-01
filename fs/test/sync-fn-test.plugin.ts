import * as govn from "./governance.ts";

// exporting a const named graphNodeName will set source.graphNodeName
export const graphNodeName = "testSyncPluginFunction-graphNodeName";
export function testSyncPluginFunction(
  tps: govn.TestPluginSupplier,
): govn.TestPluginFunctionResult {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  return { tps };
}

// publish the function so that the extension framework finds it
export default testSyncPluginFunction;
