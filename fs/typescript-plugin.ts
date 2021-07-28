import { cxg, path } from "../deps.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as fr from "../framework.ts";
import * as fs from "./file-sys-plugin.ts";

export function typeScriptFileRegistrar<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier<PE>,
  DMAC extends tsExtn.DenoModuleActivateContext<PE, PEC, PS>,
  DMAR extends tsExtn.DenoModuleActivateResult<PE, PEC, PS, DMAC>,
>(
  executive: PE,
  supplier: PS,
  tsro: tsExtn.TypeScriptRegistrarOptions<PE, PEC, PS, DMAC, DMAR>,
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
          const metaData = tsro.moduleMetaData(module);
          const source: fr.PluginSource = {
            ...originalSource,
            ...metaData.source,
          };
          const graphNode = metaData.constructGraphNode
            ? metaData.constructGraphNode(metaData)
            : new cxg.Node<fr.Plugin>(source.graphNodeName);
          const potential: tsExtn.DenoModulePlugin & {
            readonly graphNode: cxg.Node<fr.Plugin>;
          } = {
            module,
            source,
            graphNode,
            registerNode: metaData.registerNode || ((graph) => {
              graph.addNode(graphNode);
              return graphNode;
            }),
            nature: { identity: "deno-module", ...metaData.nature },
          };
          return await tsro.validateModule(
            executive,
            supplier,
            potential,
            metaData,
          );
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
