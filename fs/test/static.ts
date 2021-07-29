import { cxg } from "../../deps.ts";
import * as govn from "./governance.ts";

const url = new URL(import.meta.url);
const graphNodeName = import.meta.url;
export const custom:
  & govn.TestAction
  & govn.TestPluginActivatable
  & govn.TestState = {
    module: this,
    activateCountState: 0,
    executeCountState: 0,
    // deno-lint-ignore require-await
    activate: async (ac) => {
      custom.activateCountState++;
      return { context: ac, registration: ac.vpr };
    },
    // deno-lint-ignore require-await
    execute: async (context) => {
      custom.executeCountState++;
      return { context };
    },
    nature: { identity: `deno-${url.protocol}-${url.hostname}` },
    source: {
      systemID: import.meta.url,
      abbreviatedName: "static",
      friendlyName: url.href,
      graphNodeName,
    },
    graphNode: new cxg.Node(graphNodeName),
    registerNode: (graph) => {
      graph.addNode(custom.graphNode);
      return custom.graphNode;
    },
  };

// publish a fully constructed plugin
export default custom;
