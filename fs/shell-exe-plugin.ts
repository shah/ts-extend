import { extn, path, shell } from "./deps.ts";
import * as fs from "./file-sys-plugin.ts";

export interface ExecutableDeterminer {
  (path: string): false | string[];
}

export class ShellFileRegistrar<PM extends extn.PluginsManager>
  implements extn.PluginRegistrar {
  readonly isExecutable: ExecutableDeterminer;

  constructor(readonly manager: PM, isExecutable?: ExecutableDeterminer) {
    this.isExecutable = isExecutable || ((path: string): false | string[] => {
      const fi = Deno.statSync(path);
      const isExe = fi.mode != null ? (fi.mode & 0o0001 ? true : false) : true;
      if (isExe) {
        return [path];
      }
      return false;
    });
  }

  // deno-lint-ignore require-await
  async pluginApplicability(
    source: extn.PluginSource,
  ): Promise<extn.PluginRegistrarSourceApplicability> {
    if (fs.isFileSystemPluginSource(source)) {
      if (this.isExecutable(source.absPathAndFileName)) {
        return { isApplicable: true };
      }
    }
    return { isApplicable: false };
  }

  // deno-lint-ignore require-await
  async pluginRegistration(
    source: extn.PluginSource,
    onInvalid: (
      src: extn.PluginSource,
      suggested?: extn.InvalidPluginRegistration,
    ) => Promise<extn.PluginRegistration>,
    options?: extn.PluginRegistrationOptions,
  ): Promise<extn.PluginRegistration> {
    if (fs.isFileSystemPluginSource(source)) {
      const isExecutableCmd = this.isExecutable(source.absPathAndFileName);
      if (!isExecutableCmd) {
        const result: extn.InvalidPluginRegistration = {
          source,
          issues: [
            { source, diagnostics: ["executable bit not set on source"] },
          ],
        };
        return result;
      }
      const defaultNature = { identity: "shell-file-executable" };
      const plugin: extn.ShellExePlugin = {
        source,
        nature: options?.nature ? options.nature(defaultNature) : defaultNature,
        execute: async (seac) => {
          const pc: extn.ShellExePluginSupplier = {
            plugin,
          };
          const cmd = seac.options.shellCmdEnhancer
            ? seac.options.shellCmdEnhancer(pc, isExecutableCmd)
            : isExecutableCmd;
          const rscResult = await shell.runShellCommand(
            {
              cmd: cmd,
              cwd: path.dirname(source.absPathAndFileName),
              env: seac.options.envVarsSupplier
                ? seac.options.envVarsSupplier(pc)
                : undefined,
            },
            seac.options.runShellCmdOpts
              ? seac.options.runShellCmdOpts(pc)
              : undefined,
          );
          const actionResult: extn.ShellExeActionResult = {
            rscResult,
          };
          return actionResult;
        },
      };
      const result: extn.ValidPluginRegistration = { source, plugin };
      return result;
    }
    const result: extn.InvalidPluginRegistration = {
      source,
      issues: [{
        source,
        diagnostics: [
          "shellFileRegistrar() only knows how to register file system sources",
        ],
      }],
    };
    return onInvalid(source, result);
  }
}
