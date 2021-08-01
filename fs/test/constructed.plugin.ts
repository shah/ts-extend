import { cxg, extn } from "../deps.ts";
import * as govn from "./governance.ts";

const graphNodeName = "pre-constructed system ID";
export const constructed:
  & govn.TestPlugin
  & govn.TestActionSupplier
  & govn.TestPluginActivatable
  & govn.TestState = {
    module: this,
    activationState: 0,
    activateCountState: 0,
    deactivateCountState: 0,
    executeCountState: 0,
    // deno-lint-ignore require-await
    activate: async (ac) => {
      constructed.activateCountState++;
      ac.pluginsManager.pluginsGraph.addNode(constructed.graphNode);
      return {
        context: ac,
        registration: ac.vpr,
        activationState: extn.PluginActivationState.Active,
      };
    },
    // deno-lint-ignore require-await
    deactivate: async () => {
      constructed.deactivateCountState++;
    },
    // deno-lint-ignore require-await
    execute: async () => {
      constructed.executeCountState++;
    },
    nature: { identity: "deno-custom" },
    source: {
      systemID: "pre-constructed system ID",
      abbreviatedName: "constructed",
      friendlyName: "pre-constructed",
      graphNodeName,
    },
    graphNode: new cxg.Node(graphNodeName),
  };

// publish a fully constructed plugin
export default constructed;
