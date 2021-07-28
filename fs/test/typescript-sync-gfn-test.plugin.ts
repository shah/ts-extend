import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export function* testGenSyncPluginFunction(
  pc: mod.PluginContext<modT.TestExecutive>,
) {
  console.log("Hello World from TypeScript testSyncPluginFunction");
  yield { pc };
  return undefined;
}

// publish the function so that the extension framework finds it
export default testGenSyncPluginFunction;
