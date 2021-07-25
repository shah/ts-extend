import { path, shell } from "../deps.ts";
import * as cp from "../cmd-proxy.ts";
import * as fr from "../framework.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as fsp from "./file-sys-plugin.ts";

export interface CommandProxyFileSystemPluginsManagerOptions<
  T extends fr.PluginExecutive,
> extends cp.CommandProxyPluginsManagerOptions<T> {
  readonly discoveryPath: string;
  readonly localFsSources: fsp.FileSystemGlobs;
}

export class CommandProxyFileSystemPluginsManager<
  T extends fr.PluginExecutive,
> extends cp.CommandProxyPluginsManager<T> {
  constructor(
    readonly executive: T,
    readonly commands: Record<cp.ProxyableCommandText, cp.ProxyableCommand>,
    readonly options: CommandProxyFileSystemPluginsManagerOptions<T>,
  ) {
    super(executive, commands, options);
  }

  async init(): Promise<void> {
    const telemetry = new tsExtn.TypicalTypeScriptRegistrarTelemetry();
    await fsp.discoverFileSystemPlugins({
      discoveryPath: this.options.discoveryPath,
      globs: this.options.localFsSources,
      onValidPlugin: (vpr) => {
        this.registerValidPlugin(vpr);
      },
      onInvalidPlugin: (ipr) => {
        this.invalidPlugins.push(ipr);
      },
      shellFileRegistryOptions: {
        shellCmdEnhancer: this.options.shellCmdEnhancer
          ? this.options.shellCmdEnhancer
          : (
            (pc: fr.PluginContext<T>, suggestedCmd: string[]): string[] => {
              if (cp.isCommandProxyPluginContext(pc)) {
                return this.enhanceShellCmd(pc, suggestedCmd);
              }
              console.warn(
                `CommandProxyFileSystemPluginsManager::shellFileRegistryOptions->shellCmdEnhancer(pc, ${suggestedCmd}): pc is not a CommandProxyPluginContext`,
              );
              return suggestedCmd;
            }
          ),
        runShellCmdOpts: this.options.shellCmdPrepareRunOpts
          ? this.options.shellCmdPrepareRunOpts
          : ((): shell.RunShellCommandOptions => {
            return shell.cliVerboseShellOutputOptions;
          }),
        envVarsSupplier: this.options.shellCmdEnvVarsSupplier
          ? this.options.shellCmdEnvVarsSupplier
          : (
            (pc: fr.PluginContext<T>): Record<string, string> => {
              if (cp.isCommandProxyPluginContext(pc)) {
                return this.prepareShellCmdEnvVars(
                  pc,
                  this.options.shellCmdEnvVarsDefaultPrefix || "CMDPROXY_",
                );
              }
              console.warn(
                `CommandProxyFileSystemPluginsManager::shellFileRegistryOptions->envVarsSupplier(pc): pc is not a CommandProxyPluginContext`,
              );
              return {};
            }
          ),
        telemetry,
      },
      typeScriptFileRegistryOptions: this.options.typeScriptModuleOptions || {
        validateModule: tsExtn.registerDenoFunctionModule,
        importModule: (source: URL) => {
          return tsExtn.importCachedModule(source, telemetry);
        },
        telemetry,
      },
    });
  }

  prepareShellCmdEnvVars(
    pc: cp.CommandProxyPluginContext<T>,
    envVarsPrefix: string,
  ): Record<string, string> {
    const envVars = super.prepareShellCmdEnvVars(pc, envVarsPrefix);
    if (fsp.isDiscoverFileSystemPluginSource(pc.plugin.source)) {
      const pluginHome = path.dirname(pc.plugin.source.absPathAndFileName);
      return {
        ...envVars,
        [`${envVarsPrefix}FS_NAME`]: path.basename(
          pc.plugin.source.absPathAndFileName,
        ),
        [`${envVarsPrefix}FS_HOME_ABS`]: pluginHome,
        [`${envVarsPrefix}FS_HOME_REL`]: path.relative(
          this.options.discoveryPath,
          pluginHome,
        ),
      };
    }
    return envVars;
  }
}
