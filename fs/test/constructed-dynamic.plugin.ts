import { cxg, extn } from "../deps.ts";
import * as dsp from "../../plugins/module.ts";
import * as govn from "./governance.ts";

export const scalarValue =
  "this is the default value, which can be different from the plugin";

export const plugin: dsp.DenoModuleDynamicPluginSupplier<extn.PluginsManager> =
  // deno-lint-ignore require-await
  async (moduleEntryPoint, nature) => {
    const graphNodeName = "pre-constructed dynamic system ID";
    const potential:
      & govn.TestPlugin
      & dsp.DenoScalarModulePlugin<string>
      & govn.TestActionSupplier
      & govn.TestPluginActivatable
      & extn.PluginGraphContributor
      & govn.TestState = {
        module: moduleEntryPoint,
        activationState: 0,
        activateCountState: 0,
        activateGraphCountState: 0,
        deactivateGraphCountState: 0,
        deactivateCountState: 0,
        executeCountState: 0,
        // deno-lint-ignore require-await
        activate: async (ac) => {
          potential.activateCountState++;
          return {
            context: ac,
            registration: ac.vpr,
            activationState: extn.PluginActivationState.Active,
          };
        },
        activateGraphNode: (graph) => {
          potential.activateGraphCountState++;
          graph.addNode(potential.graphNode);
          return potential.graphNode;
        },
        deactivateGraphNode: (_graph) => {
          potential.deactivateGraphCountState++;
        },
        // deno-lint-ignore require-await
        deactivate: async () => {
          potential.deactivateCountState++;
        },
        // deno-lint-ignore require-await
        execute: async () => {
          potential.executeCountState++;
        },
        nature: { ...nature, identity: "deno-dynamic" },
        source: {
          registrarID: "deno-dynamic",
          systemID: "pre-constructed dynamic system ID",
          abbreviatedName: "constructed dynamic",
          friendlyName: "pre-constructed dynamic",
          graphNodeName,
        },
        graphNode: new cxg.Node(graphNodeName),
        scalar: scalarValue,
      };
    const result: extn.ValidPluginRegistration = {
      plugin: potential,
      source: potential.source,
    };
    return result;
  };

// since we constructed our own plugin we can provide any default
export default scalarValue;
