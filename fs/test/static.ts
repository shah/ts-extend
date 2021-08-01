import { cxg, extn } from "../deps.ts";
import * as govn from "./governance.ts";

const url = new URL(import.meta.url);
const graphNodeName = import.meta.url;
export const custom:
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
      custom.activateCountState++;
      ac.pluginsManager.pluginsGraph.addNode(custom.graphNode);
      return {
        context: ac,
        registration: ac.vpr,
        activationState: extn.PluginActivationState.Active,
      };
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
      systemID: import.meta.url,
      abbreviatedName: "static",
      friendlyName: url.href,
      graphNodeName,
    },
    graphNode: new cxg.Node(graphNodeName),
  };

// publish a fully constructed plugin
export default custom;
