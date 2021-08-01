import * as govn from "./governance.ts";

export async function* testAsyncGeneratorPluginFunction(
  tps: govn.TestPluginSupplier,
): AsyncGenerator<govn.TestPluginFunctionResult, undefined, unknown> {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  yield { tps };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testAsyncGeneratorPluginFunction;
