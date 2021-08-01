import * as govn from "./governance.ts";

export function* testGenSyncPluginFunction(tps: govn.TestPluginSupplier) {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  yield { tps };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testGenSyncPluginFunction;
