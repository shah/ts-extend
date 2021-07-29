import * as govn from "./governance.ts";

// deno-lint-ignore require-await
export async function testAsyncPluginFunction(
  context: govn.TestPluginContext,
): Promise<govn.TestPluginActionResult> {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  return { context };
}

// publish the function so that the extension framework finds it
export default testAsyncPluginFunction;
