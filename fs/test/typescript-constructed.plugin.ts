import { cxg } from "../../deps.ts";
import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

type PluginContext = mod.PluginContext<modT.TestExecutive>;

const graphNodeName = "pre-constructed system ID";
export const constructed:
  & mod.DenoModulePlugin
  & mod.DenoModuleActivatable<
    modT.TestExecutive,
    PluginContext,
    mod.PluginsSupplier,
    mod.DenoModuleActivateContext<
      modT.TestExecutive,
      PluginContext,
      mod.PluginsSupplier
    >,
    mod.DenoModuleActivateResult<
      modT.TestExecutive,
      PluginContext,
      mod.PluginsSupplier,
      mod.DenoModuleActivateContext<
        modT.TestExecutive,
        PluginContext,
        mod.PluginsSupplier
      >
    >
  >
  & mod.Action<
    modT.TestExecutive,
    PluginContext,
    mod.ActionResult<modT.TestExecutive, PluginContext>
  >
  & {
    activateCountState: number;
    executeCountState: number;
    readonly graphNode: mod.PluginGraphNode;
  } = {
    module: this,
    activateCountState: 0,
    executeCountState: 0,
    // deno-lint-ignore require-await
    activate: async (ac) => {
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
      graphNodeName,
    },
    graphNode: new cxg.Node(graphNodeName),
    registerNode: (graph) => {
      graph.addNode(constructed.graphNode);
      return constructed.graphNode;
    },
  };

// publish a fully constructed plugin
export default constructed;
