import * as govn from "./governance.ts";
import { cxg } from "../../deps.ts";

const graphNodeName = "pre-constructed system ID";
export const constructed:
  & govn.TestAction
  & govn.TestPluginActivatable
  & govn.TestState = {
    module: this,
    activateCountState: 0,
    executeCountState: 0,
    // deno-lint-ignore require-await
    activate: async (ac) => {
      constructed.activateCountState++;
      return { context: ac, registration: ac.vpr };
    },
    // deno-lint-ignore require-await
    execute: async (context) => {
      constructed.executeCountState++;
      return { context };
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
