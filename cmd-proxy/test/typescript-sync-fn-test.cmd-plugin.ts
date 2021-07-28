import * as govn from "./governance.ts";

// use "default" to publish the function so that the extension framework finds it
export default function testSyncPluginFunction(
  context: govn.TestPluginContext,
): govn.TestPluginActionResult {
  return { context };
}
