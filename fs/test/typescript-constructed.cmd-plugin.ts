import { cxg } from "../../deps.ts";
import * as mod from "../../mod.ts";
import * as modT from "../../mod_test.ts";

const graphNodeName = "pre-constructed system ID";
export const constructed:
  & mod.DenoModulePlugin
  & mod.Action<modT.TestExecutive>
  & {
    executeCountState: number;
    readonly graphNode: cxg.Node<mod.Plugin>;
  } = {
    module: this,
    executeCountState: 0,
    // deno-lint-ignore require-await
    execute: async (
      pc: mod.PluginContext<modT.TestExecutive>,
    ): Promise<mod.ActionResult<modT.TestExecutive>> => {
      constructed.executeCountState++;
      return { pc };
    },
    nature: { identity: "deno-custom" },
    source: {
      systemID: "pre-constructed system ID",
      abbreviatedName: "constructed",
      friendlyName: "pre-constructed",
      graphNodeName: graphNodeName,
    },
    graphNode: new cxg.Node(graphNodeName),
    registerNode: (graph) => {
      graph.addNode(constructed.graphNode);
      return constructed.graphNode;
    },
  };

// publish a fully constructed plugin
export default constructed;
