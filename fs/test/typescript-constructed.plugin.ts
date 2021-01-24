import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

export const constructed:
  & mod.DenoModulePlugin
  & mod.Action<modT.TestExecutive> = {
    module: this,
    // deno-lint-ignore require-await
    execute: async (
      pc: mod.PluginContext<modT.TestExecutive>,
    ): Promise<mod.ActionResult<modT.TestExecutive>> => {
      console.log("Hello World from TypeScript constructed");
      return { pc };
    },
    nature: { identity: "deno-custom" },
    source: {
      systemID: "pre-constructed system ID",
      abbreviatedName: "constructed",
      friendlyName: "pre-constructed",
    },
  };

// publish a fully constructed plugin
export default constructed;
