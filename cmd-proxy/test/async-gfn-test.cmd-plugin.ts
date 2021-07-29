import * as govn from "./governance.ts";

export async function* testAsyncGenPluginFunction(
  context: govn.TestPluginContext,
): AsyncGenerator<govn.TestPluginActionResult, void, unknown> {
  // just return the whole context, which shows we can do whatever we want
  yield { context };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testAsyncGenPluginFunction;
