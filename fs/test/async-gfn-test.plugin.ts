import * as govn from "./governance.ts";

export async function* testAsyncGeneratorPluginFunction(
  context: govn.TestPluginContext,
): AsyncGenerator<govn.TestPluginActionResult, undefined, unknown> {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  yield { context };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testAsyncGeneratorPluginFunction;
