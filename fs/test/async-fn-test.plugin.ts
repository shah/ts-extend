import * as govn from "./governance.ts";

// deno-lint-ignore require-await
export const testAsyncPluginFunction: govn.TestPluginFunction = async (ps) => {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  return { ps };
};

// publish the function so that the extension framework finds it
export default testAsyncPluginFunction;
