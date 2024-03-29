import { path, shell } from "../deps.ts";
import * as cp from "./cmd-proxy.ts";
import * as fr from "../framework.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as fsp from "../fs/file-sys-plugin.ts";

export interface CommandProxyFileSystemPluginsManagerOptions<
  PE extends fr.PluginExecutive,
> extends cp.CommandProxyPluginsManagerOptions<PE> {
  readonly discoveryPath: string;
  readonly localFsSources: fsp.FileSystemGlobs;
}

export class CommandProxyFileSystemPluginsManager<PE extends fr.PluginExecutive>
  extends cp.CommandProxyPluginsManager<PE> {
  constructor(
    readonly executive: PE,
    readonly commands: Record<cp.ProxyableCommandText, cp.ProxyableCommand>,
    readonly options: CommandProxyFileSystemPluginsManagerOptions<PE>,
  ) {
    super(executive, commands, options);
  }

  protected async init(): Promise<void> {
    const telemetry = new tsExtn.TypicalTypeScriptRegistrarTelemetry();
    const typeScriptFileRegistryOptions: tsExtn.TypeScriptRegistrarOptions<PE> =
      this.options.typeScriptModuleOptions || {
        validateModule: tsExtn.registerDenoFunctionModule,
        importModule: (source: URL) => {
          return tsExtn.importCachedModule(source, telemetry);
        },
        moduleMetaData: tsExtn.moduleMetaData,
        activate: tsExtn.typicalDenoModuleActivate,
        telemetry,
      };
    await fsp.discoverFileSystemPlugins(this.executive, this, {
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
            (pc: fr.PluginContext<PE>, suggestedCmd: string[]): string[] => {
              if (cp.isCommandProxyPluginContext<PE>(pc)) {
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
            (pc: fr.PluginContext<PE>): Record<string, string> => {
              if (cp.isCommandProxyPluginContext<PE>(pc)) {
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
      typeScriptFileRegistryOptions,
    });
  }

  prepareShellCmdEnvVars(
    pc: cp.CommandProxyPluginContext<PE>,
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
