import { cxg, govnSvcTelemetry as telem, path, shell } from "../deps.ts";
import * as fr from "../framework.ts";
import * as shExtn from "../shell-exe-extn.ts";
import * as fs from "./file-sys-plugin.ts";

export interface ShellFileRegistrarOptions<PE extends fr.PluginExecutive> {
  readonly envVarsSupplier?: shExtn.ShellCmdEnvVarsSupplier<PE>;
  readonly shellCmdEnhancer?: shExtn.ShellCmdEnhancer<PE>;
  readonly runShellCmdOpts?: shExtn.PrepareShellCmdRunOptions<PE>;
  // TODO: create activePlugin similar to TypeScript
  // readonly activatePlugin: (
  //   dmac: DMAC,
  //   plugin: DenoModulePlugin,
  // ) => Promise<DMAR | false>;
  readonly telemetry: telem.Telemetry;
}

export function shellFileRegistrarSync<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
  SEAR extends shExtn.ShellExeActionResult<PE, PC>,
>(
  options: ShellFileRegistrarOptions<PE>,
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
      const graphNode = new cxg.Node<fr.Plugin>(source.graphNodeName);
      const plugin: shExtn.ShellExePlugin<PE> & {
        readonly graphNode: cxg.Node<fr.Plugin>;
      } = {
        source,
        nature: { identity: "shell-file-executable" },
        graphNode,
        // TODO: add activate() to manage graphs
        // registerNode: (graph) => {
        //   graph.addNode(graphNode);
        //   return graphNode;
        // },
        envVars: options.envVarsSupplier,
        shellCmd: (pc: fr.PluginContext<PE>): string[] => {
          return options.shellCmdEnhancer
            ? options.shellCmdEnhancer(pc, isExecutableCmd)
            : isExecutableCmd;
        },
        execute: async (context) => {
          const cmd = options.shellCmdEnhancer
            ? options.shellCmdEnhancer(context, isExecutableCmd)
            : isExecutableCmd;
          const rscResult = await shell.runShellCommand(
            {
              cmd: cmd,
              cwd: path.dirname(source.absPathAndFileName),
              env: options.envVarsSupplier
                ? options.envVarsSupplier(context)
                : undefined,
            },
            options.runShellCmdOpts
              ? options.runShellCmdOpts(context)
              : undefined,
          );
          const actionResult: SEAR = {
            context,
            rscResult,
          } as SEAR; // TODO: this shouldn't be necessary but was getting TS error :-(
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

export function shellFileRegistrar<PE extends fr.PluginExecutive>(
  options: ShellFileRegistrarOptions<PE>,
): fr.PluginRegistrar {
  const regSync = shellFileRegistrarSync(options);

  // deno-lint-ignore require-await
  return async (source: fr.PluginSource): Promise<fr.PluginRegistration> => {
    return regSync(source);
  };
}
