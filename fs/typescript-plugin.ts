import { cxg, extn, path } from "./deps.ts";
import * as fs from "./file-sys-plugin.ts";

export class TypeScriptFileRegistrar<PM extends extn.PluginsManager>
  implements extn.PluginRegistrar {
  constructor(
    readonly manager: PM,
    readonly tsro: extn.TypeScriptRegistrarOptions<PM>,
  ) {
  }

  // deno-lint-ignore require-await
  async pluginApplicability(
    source: extn.PluginSource,
  ): Promise<extn.PluginRegistrarSourceApplicability> {
    if (fs.isFileSystemPluginSource(source)) {
      if (path.extname(source.absPathAndFileName) == ".ts") {
        return { isApplicable: true };
      }
    }
    return { isApplicable: false };
  }

  async pluginRegistration(
    originalSource: extn.PluginSource,
    onInvalid: (
      src: extn.PluginSource,
      suggested?: extn.InvalidPluginRegistration,
    ) => Promise<extn.PluginRegistration>,
  ): Promise<extn.PluginRegistration> {
    if (fs.isFileSystemPluginSource(originalSource)) {
      try {
        // the ts-extn package is going to be URL-imported but the files
        // we're importing are local to the calling pubctl.ts in the project
        // so we need to use absolute paths
        const module = await this.tsro.importModule(
          path.toFileUrl(originalSource.absPathAndFileName),
        );
        if (module) {
          const metaData = this.tsro.moduleMetaData(module);
          const source: extn.PluginSource = {
            ...originalSource,
            ...metaData.source,
          };
          const graphNode = metaData.constructGraphNode
            ? metaData.constructGraphNode(metaData)
            : new cxg.Node<extn.Plugin>(source.graphNodeName);
          const potential: extn.DenoModulePlugin & {
            readonly graphNode: cxg.Node<extn.Plugin>;
          } = {
            module,
            source,
            graphNode,
            nature: { identity: "deno-module", ...metaData.nature },
          };
          return await this.tsro.validateModule(
            this.manager,
            potential,
            metaData,
          );
        } else {
          const result: extn.InvalidPluginRegistration = {
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
        const result: extn.InvalidPluginRegistration = {
          source: originalSource,
          issues: [{ source: originalSource, diagnostics: [err] }],
        };
        return result;
      }
    }
    const result: extn.InvalidPluginRegistration = {
      source: originalSource,
      issues: [{
        source: originalSource,
        diagnostics: [
          "typeScriptFileRegistrar() only knows how to register file system sources",
        ],
      }],
    };
    return onInvalid(originalSource, result);
  }
}
