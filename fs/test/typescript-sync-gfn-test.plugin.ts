import * as govn from "./governance.ts";

export function* testGenSyncPluginFunction(
  context: govn.TestPluginContext,
) {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  yield { context };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testGenSyncPluginFunction;
