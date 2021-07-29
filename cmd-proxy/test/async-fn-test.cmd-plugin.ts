import * as govn from "./governance.ts";

// publish the function so that the extension framework finds it
// deno-lint-ignore require-await
export default async function (
  context: govn.TestPluginContext,
): Promise<govn.TestPluginActionResult> {
  // just return the whole context, which shows we can do whatever we want
  return { context };
}
