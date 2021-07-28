import { path, shell } from "../deps.ts";
import * as cp from "./cmd-proxy.ts";
import * as fr from "../framework.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as fsp from "../fs/file-sys-plugin.ts";

export interface CommandProxyFileSystemPluginsManagerOptions<
  PE extends fr.PluginExecutive,
  CPPC extends cp.CommandProxyPluginContext<PE>,
  PS extends fr.PluginsSupplier<PE>,
  DMAC extends tsExtn.DenoModuleActivateContext<PE, CPPC, PS>,
  DMAR extends tsExtn.DenoModuleActivateResult<PE, CPPC, PS, DMAC>,
  AR extends fr.ActionResult<PE, CPPC>,
> extends cp.CommandProxyPluginsManagerOptions<PE, CPPC, PS, DMAC, DMAR> {
  readonly discoveryPath: string;
  readonly localFsSources: fsp.FileSystemGlobs;
}

export class CommandProxyFileSystemPluginsManager<
  PE extends fr.PluginExecutive,
  CPPC extends cp.CommandProxyPluginContext<PE>,
  DMAC extends tsExtn.DenoModuleActivateContext<
    PE,
    CPPC,
    CommandProxyFileSystemPluginsManager<PE, CPPC, DMAC, DMAR, AR>
  >,
  DMAR extends tsExtn.DenoModuleActivateResult<
    PE,
    CPPC,
    CommandProxyFileSystemPluginsManager<PE, CPPC, DMAC, DMAR, AR>,
    DMAC
  >,
  AR extends fr.ActionResult<PE, CPPC>,
> extends cp.CommandProxyPluginsManager<
  PE,
  CPPC,
  CommandProxyFileSystemPluginsManager<PE, CPPC, DMAC, DMAR, AR>,
  DMAC,
  DMAR,
  AR
> {
  constructor(
    readonly executive: PE,
    readonly commands: Record<cp.ProxyableCommandText, cp.ProxyableCommand>,
    readonly options: CommandProxyFileSystemPluginsManagerOptions<
      PE,
      CPPC,
      CommandProxyFileSystemPluginsManager<PE, CPPC, DMAC, DMAR, AR>,
      DMAC,
      DMAR,
      AR
    >,
  ) {
    super(executive, commands, options);
  }

  protected async init(): Promise<void> {
    const telemetry = new tsExtn.TypicalTypeScriptRegistrarTelemetry();
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
            (pc: CPPC, suggestedCmd: string[]): string[] => {
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
            (pc: CPPC): Record<string, string> => {
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
      typeScriptFileRegistryOptions: this.options.typeScriptModuleOptions || {
        validateModule: tsExtn.registerDenoFunctionModule,
        importModule: (source: URL) => {
          return tsExtn.importCachedModule(source, telemetry);
        },
        moduleMetaData: tsExtn.moduleMetaData,
        telemetry,
      },
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
