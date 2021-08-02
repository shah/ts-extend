import { cxg, extn } from "../deps.ts";
import * as govn from "./governance.ts";

const url = new URL(import.meta.url);
const graphNodeName = import.meta.url;
export const custom:
  & govn.TestPlugin
  & govn.TestActionSupplier
  & govn.TestPluginActivatable
  & extn.PluginGraphContributor
  & govn.TestState = {
    module: this,
    activationState: 0,
    activateCountState: 0,
    activateGraphCountState: 0,
    deactivateGraphCountState: 0,
    deactivateCountState: 0,
    executeCountState: 0,
    // deno-lint-ignore require-await
    activate: async (ac) => {
      custom.activateCountState++;
      return {
        context: ac,
        registration: ac.vpr,
        activationState: extn.PluginActivationState.Active,
      };
    },
    activateGraphNode: (graph) => {
      custom.activateGraphCountState++;
      graph.addNode(custom.graphNode);
      return custom.graphNode;
    },
    deactivateGraphNode: (_graph) => {
      custom.deactivateGraphCountState++;
    },
    // deno-lint-ignore require-await
    deactivate: async () => {
      custom.deactivateCountState++;
    },
    // deno-lint-ignore require-await
    execute: async () => {
      custom.executeCountState++;
    },
    nature: { identity: `deno-${url.protocol}-${url.hostname}` },
    source: {
      registrarID: "static",
      systemID: import.meta.url,
      abbreviatedName: "static",
      friendlyName: url.href,
      graphNodeName,
    },
    graphNode: new cxg.Node(graphNodeName),
  };

// publish a fully constructed plugin
export default custom;
