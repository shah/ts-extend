import { cxg, extn, path, shell } from "../deps.ts";
import * as shPlugin from "../../plugins/shell-exe.ts";
import * as fs from "../file-sys-plugin.ts";

export interface ExecutableDeterminer {
  (path: string): false | string[];
}

export class ShellFileRegistrar<PM extends extn.PluginsManager>
  implements extn.PluginRegistrar {
  readonly registrarID = "ShellFileRegistrar";
  readonly isExecutable: ExecutableDeterminer;

  constructor(
    readonly manager: PM,
    isExecutable?: ExecutableDeterminer,
  ) {
    this.isExecutable = isExecutable || ((path: string): false | string[] => {
      const fi = Deno.statSync(path);
      const isExe = fi.mode != null ? (fi.mode & 0o0001 ? true : false) : false;
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
        const fi = Deno.statSync(source.absPathAndFileName);
        const result: extn.InvalidPluginRegistration = {
          source,
          issues: [
            {
              source,
              diagnostics: [
                `source is not executable (executable bit not set?): file mode is ${fi.mode}}`,
              ],
            },
          ],
        };
        return result;
      }
      const defaultNature = { identity: "shell-file-executable" };
      const nature = options?.nature
        ? options.nature(defaultNature)
        : defaultNature;
      const defaultGraphNode = new cxg.Node<extn.Plugin>(source.graphNodeName);
      const graphNode = options?.graphNode
        ? options?.graphNode({ nature, source }, defaultGraphNode)
        : defaultGraphNode;
      const plugin:
        & shPlugin.ShellExePlugin
        & extn.PluginGraphNodeSupplier
        & extn.PluginGraphContributor = {
          source,
          nature,
          graphNode,
          activateGraphNode: (graph) => {
            graph.addNode(graphNode);
            return graphNode;
          },
          execute: async (seac) => {
            const pc: shPlugin.ShellExePluginSupplier = {
              plugin,
            };
            const cmd = seac.options.shellCmdEnhancer
              ? seac.options.shellCmdEnhancer(pc, isExecutableCmd)
              : isExecutableCmd;
            const metric = seac.telemetry.execute(cmd);
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
            const actionResult: shPlugin.ShellExeActionResult = {
              rscResult,
            };
            metric.measure();
            return actionResult;
          },
        };
      if (!options?.guard || options.guard.guard(plugin)) {
        const result: extn.ValidPluginRegistration = { source, plugin };
        return options?.transform ? options?.transform(result) : result;
      }

      const result: extn.InvalidPluginRegistration = {
        source,
        issues: [{
          source,
          diagnostics: [options.guard.guardFailureDiagnostic(plugin)],
        }],
      };
      return onInvalid(source, result);
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
