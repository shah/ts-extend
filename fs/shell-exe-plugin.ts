import { path, shell } from "../deps.ts";
import * as fr from "../framework.ts";
import * as shExtn from "../shell-exe-extn.ts";
import * as fs from "./file-sys-plugin.ts";

export interface ShellFileRegistrarOptions<T extends fr.PluginExecutive> {
  readonly envVarsSupplier?: shExtn.ShellCmdEnvVarsSupplier<T>;
  readonly shellCmdEnhancer?: shExtn.ShellCmdEnhancer<T>;
  readonly runShellCmdOpts?: shExtn.PrepareShellCmdRunOptions<T>;
}

export function shellFileRegistrarSync<T extends fr.PluginExecutive>(
  options: ShellFileRegistrarOptions<T>,
): fr.PluginRegistrarSync {
  const isExecutable = (path: string): false | string[] => {
    const fi = Deno.statSync(path);
    const isExe = fi.mode != null ? (fi.mode & 0o0001 ? true : false) : true;
    if (isExe) {
      return ["/bin/sh", "-c", path];
    }
    return false;
  };

  return (source: fr.PluginSource): fr.PluginRegistration => {
    if (fs.isFileSystemPluginSource(source)) {
      const isExecutableCmd = isExecutable(source.absPathAndFileName);
      if (!isExecutableCmd) {
        const result: fr.InvalidPluginRegistration = {
          source,
          issues: [
            { source, diagnostics: ["executable bit not set on source"] },
          ],
        };
        return result;
      }
      const plugin: shExtn.ShellExePlugin<T> = {
        source,
        nature: { identity: "shell-file-executable" },
        envVars: options.envVarsSupplier,
        shellCmd: (pc: fr.PluginContext<T>): string[] => {
          return options.shellCmdEnhancer
            ? options.shellCmdEnhancer(pc, isExecutableCmd)
            : isExecutableCmd;
        },
        execute: async (
          pc: fr.PluginContext<T>,
        ): Promise<fr.ActionResult<T>> => {
          const cmd = options.shellCmdEnhancer
            ? options.shellCmdEnhancer(pc, isExecutableCmd)
            : isExecutableCmd;
          const rscResult = await shell.runShellCommand(
            {
              cmd: cmd,
              cwd: path.dirname(source.absPathAndFileName),
              env: options.envVarsSupplier
                ? options.envVarsSupplier(pc)
                : undefined,
            },
            options.runShellCmdOpts ? options.runShellCmdOpts(pc) : undefined,
          );
          const actionResult: shExtn.ShellExeActionResult<T> = {
            pc,
            rscResult,
          };
          return actionResult;
        },
      };
      const result: fr.ValidPluginRegistration = { source, plugin };
      return result;
    }
    const result: fr.InvalidPluginRegistration = {
      source,
      issues: [{
        source,
        diagnostics: [
          "shellFileRegistrar() only knows how to register file system sources",
        ],
      }],
    };
    return result;
  };
}

export function shellFileRegistrar<T extends fr.PluginExecutive>(
  options: ShellFileRegistrarOptions<T>,
): fr.PluginRegistrar {
  const regSync = shellFileRegistrarSync(options);

  // deno-lint-ignore require-await
  return async (source: fr.PluginSource): Promise<fr.PluginRegistration> => {
    return regSync(source);
  };
}
