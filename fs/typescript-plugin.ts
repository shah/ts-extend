import { cxg, path } from "../deps.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as fr from "../framework.ts";
import * as fs from "./file-sys-plugin.ts";

export function overrides(
  module: unknown,
  source: fr.PluginSource,
): {
  source: fr.PluginSource;
  nature: fr.PluginNature | undefined;
  registerNode: ((graph: cxg.CxGraph) => cxg.Node<fr.Plugin>) | undefined;
} {
  let nature: fr.PluginNature | undefined;
  let registerNode: ((graph: cxg.CxGraph) => cxg.Node<fr.Plugin>) | undefined;
  for (const entry of Object.entries(module as Record<string, unknown>)) {
    const [key, value] = entry;
    if (typeof value === "string") {
      switch (key) {
        case "systemID":
          // if module has `export const systemID = "X"` then use that as the graphName
          // deno-lint-ignore no-explicit-any
          (source as any).systemID = value;
          break;

        case "friendlyName":
          // if module has `export const friendlyName = "X"` then use that as the graphName
          // deno-lint-ignore no-explicit-any
          (source as any).friendlyName = value;
          break;

        case "abbreviatedName":
          // if module has `export const abbreviatedName = "X"` then use that as the graphName
          // deno-lint-ignore no-explicit-any
          (source as any).abbreviatedName = value;
          break;

        case "graphNodeName":
          // if module has `export const graphNodeName = "X"` then use that as the graphName
          // deno-lint-ignore no-explicit-any
          (source as any).graphNodeName = value;
          break;
      }

      continue;
    }

    if (key === "nature" && fr.isPluginNature(value)) nature = value;
    if (key === "registerNode" && typeof value === "function") {
      // TODO: enhance type checking
      registerNode = value as ((graph: cxg.CxGraph) => cxg.Node<fr.Plugin>);
    }
  }

  return { source, nature, registerNode };
}

export function typeScriptFileRegistrar(
  tsro: tsExtn.TypeScriptRegistrarOptions,
): fr.PluginRegistrar {
  return async (
    originalSource: fr.PluginSource,
  ): Promise<fr.PluginRegistration> => {
    if (fs.isFileSystemPluginSource(originalSource)) {
      try {
        // the ts-extn package is going to be URL-imported but the files
        // we're importing are local to the calling pubctl.ts in the project
        // so we need to use absolute paths
        const module = await tsro.importModule(
          path.toFileUrl(originalSource.absPathAndFileName),
        );
        if (module) {
          const { source, nature, registerNode } = overrides(
            module,
            originalSource,
          );
          const graphNode = new cxg.Node<fr.Plugin>(source.graphNodeName);
          const potential: tsExtn.DenoModulePlugin & {
            readonly graphNode: cxg.Node<fr.Plugin>;
          } = {
            module,
            source,
            graphNode,
            registerNode: registerNode || ((graph) => {
              graph.addNode(graphNode);
              return graphNode;
            }),
            nature: nature || { identity: "deno-module" },
          };
          return tsro.validateModule(potential);
        } else {
          const result: fr.InvalidPluginRegistration = {
            source: originalSource,
            issues: [{
              source: originalSource,
              diagnostics: [
                "invalid typeScriptFileRegistrar plugin: unable to import module (unknown error)",
              ],
            }],
          };
          return result;
        }
      } catch (err) {
        const result: fr.InvalidPluginRegistration = {
          source: originalSource,
          issues: [{ source: originalSource, diagnostics: [err] }],
        };
        return result;
      }
    }
    const result: fr.InvalidPluginRegistration = {
      source: originalSource,
      issues: [{
        source: originalSource,
        diagnostics: [
          "typeScriptFileRegistrar() only knows how to register file system sources",
        ],
      }],
    };
    return result;
  };
}
