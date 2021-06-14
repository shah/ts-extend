import { path } from "../deps.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as fr from "../framework.ts";
import * as fs from "./file-sys-plugin.ts";

export function typeScriptFileRegistrar(
  tsro: tsExtn.TypeScriptRegistrarOptions,
): fr.PluginRegistrar {
  return async (source: fr.PluginSource): Promise<fr.PluginRegistration> => {
    if (fs.isFileSystemPluginSource(source)) {
      try {
        // the ts-extn package is going to be URL-imported but the files
        // we're importing are local to the calling pubctl.ts in the project
        // so we need to use absolute paths
        const module = await tsro.importModule(
          path.toFileUrl(source.absPathAndFileName),
        );
        if (module) {
          const potential: tsExtn.DenoModulePlugin = {
            module,
            source,
            nature: { identity: "deno-module" },
          };
          return tsro.validateModule(potential);
        } else {
          const result: fr.InvalidPluginRegistration = {
            source,
            issues: [{
              source,
              diagnostics: [
                "invalid typeScriptFileRegistrar plugin: unable to import module (unknown error)",
              ],
            }],
          };
          return result;
        }
      } catch (err) {
        const result: fr.InvalidPluginRegistration = {
          source,
          issues: [{ source, diagnostics: [err] }],
        };
        return result;
      }
    }
    const result: fr.InvalidPluginRegistration = {
      source,
      issues: [{
        source,
        diagnostics: [
          "typeScriptFileRegistrar() only knows how to register file system sources",
        ],
      }],
    };
    return result;
  };
}
