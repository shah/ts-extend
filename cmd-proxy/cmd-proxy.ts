import { cxg, safety } from "../deps.ts";
import * as fr from "../framework.ts";
import * as shExtn from "../shell-exe-extn.ts";
import * as tsExtn from "../typescript-extn.ts";

export type CommandProxyPluginActivityMessage = string;

export interface CommandProxyPluginActivity {
  readonly message: CommandProxyPluginActivityMessage;
}

export function commandProxyActivity(
  message: string,
  defaults?: Partial<Omit<CommandProxyPluginActivity, "message">>,
): CommandProxyPluginActivity {
  return {
    message,
    ...defaults,
  };
}

export interface CommandProxyPluginActivityReporter {
  (a: CommandProxyPluginActivity, options?: { dryRun?: boolean }): void;
}

export interface CommandProxyPluginActivityReporterSupplier {
  readonly onActivity: CommandProxyPluginActivityReporter;
}

export const isCommandProxyPluginActivityReporterSupplier = safety.typeGuard<
  CommandProxyPluginActivityReporterSupplier
>("onActivity");

/**
 * ProxyableCommandText is the name of a "hook" that can be extended.
 */
export type ProxyableCommandText = string;

/**
 * ProxyableCommand is a "hook" that can be executed by plugin.
 */
export interface ProxyableCommand {
  readonly proxyCmd: ProxyableCommandText;
}

export interface DryRunnableProxyableCommand {
  readonly isDryRun: boolean;
}

export const isCommandDryRunnable = safety.typeGuard<
  DryRunnableProxyableCommand
>("isDryRun");

export interface CommandProxyPluginContext<PE extends fr.PluginExecutive>
  extends fr.PluginContext<PE> {
  readonly command: ProxyableCommand;
  readonly arguments?: Record<string, string>;
}

export function isCommandProxyPluginContext<
  PE extends fr.PluginExecutive,
>(
  o: unknown,
): o is CommandProxyPluginContext<PE> {
  if (fr.isPluginContext(o)) {
    return "command" in o;
  }
  return false;
}

/**
   * defaultTypeScriptPluginResultEnhancer should be called by all Deno
   * TypeScript plugins so that we can do centralized "enhancing" of the
   * results of any extension. This allows logging, middleware, and other
   * standard function handling capabilities.
   * @param dfmhResult
   */
export function defaultTypeScriptPluginResultEnhancer<
  PE extends fr.PluginExecutive,
>(
  _cppc: CommandProxyPluginContext<PE>,
  dfmhResult?: tsExtn.DenoFunctionModuleHandlerResult,
): tsExtn.DenoFunctionModuleHandlerResult {
  if (!dfmhResult) return {};
  return dfmhResult;
}

export interface CommandProxyPluginsManagerOptions<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
  PS extends fr.PluginsSupplier<PE>,
  DMAC extends tsExtn.DenoModuleActivateContext<PE, PC, PS>,
  DMAR extends tsExtn.DenoModuleActivateResult<PE, PC, PS, DMAC>,
> {
  readonly shellCmdEnvVarsSupplier?: shExtn.ShellCmdEnvVarsSupplier<PE, PC>;
  readonly shellCmdEnvVarsDefaultPrefix?: string;
  readonly shellCmdEnhancer?: shExtn.ShellCmdEnhancer<PE, PC>;
  readonly shellCmdPrepareRunOpts?: shExtn.PrepareShellCmdRunOptions<PE, PC>;
  readonly typeScriptModuleOptions?: tsExtn.TypeScriptRegistrarOptions<
    PE,
    PC,
    PS,
    DMAC,
    DMAR
  >;
}

export class CommandProxyPluginsManager<
  PE extends fr.PluginExecutive,
  CPPC extends CommandProxyPluginContext<PE>,
  PS extends fr.PluginsSupplier<PE>,
  DMAC extends tsExtn.DenoModuleActivateContext<PE, CPPC, PS>,
  DMAR extends tsExtn.DenoModuleActivateResult<PE, CPPC, PS, DMAC>,
  AR extends fr.ActionResult<PE, CPPC>,
> implements fr.PluginsSupplier<PE> {
  readonly plugins: fr.Plugin[] = [];
  readonly validInactivePlugins: fr.ValidPluginRegistration[] = [];
  readonly pluginsGraph: fr.PluginsGraph = new cxg.CxGraph();
  readonly invalidPlugins: fr.InvalidPluginRegistration[] = [];

  constructor(
    readonly executive: PE,
    readonly commands: Record<ProxyableCommandText, ProxyableCommand>,
    readonly options: CommandProxyPluginsManagerOptions<
      PE,
      CPPC,
      PS,
      DMAC,
      DMAR
    >,
  ) {
  }

  protected async init(): Promise<void> {
  }

  async activate(): Promise<void> {
    await this.init();
    for (const vpr of this.validInactivePlugins) {
      const dmac: DMAC = {
        context: { container: this.executive },
        supplier: this,
        vpr,
      } as unknown as DMAC; // TODO figure out why this requires cast :-(
      if (
        tsExtn.isDenoModuleActivatablePlugin<PE, CPPC, PS, DMAC, DMAR>(
          dmac.vpr.plugin,
        )
      ) {
        const activatedPR = await dmac.vpr.plugin.activate(dmac);
        if (fr.isValidPluginRegistration(activatedPR.registration)) {
          this.plugins.push(dmac.vpr.plugin);
          dmac.vpr.plugin.registerNode(this.pluginsGraph);
        } else {
          this.handleInvalidPlugin(activatedPR.registration);
        }
      } else {
        // not a typescript module or no activation hook requested, no special activation
        this.plugins.push(dmac.vpr.plugin);
        dmac.vpr.plugin.registerNode(this.pluginsGraph);
      }
    }
  }

  registerValidPlugin(vpr: fr.ValidPluginRegistration): fr.Plugin {
    // TODO: make sure not to register duplicates; if it's a duplicate,
    // do not add, just return the existing one
    this.validInactivePlugins.push(vpr);
    return vpr.plugin;
  }

  handleInvalidPlugin(
    ipr: fr.InvalidPluginRegistration,
  ): fr.InvalidPluginRegistration {
    this.invalidPlugins.push(ipr);
    return ipr;
  }

  enhanceShellCmd(
    pc: CommandProxyPluginContext<PE>,
    suggestedCmd: string[],
  ): string[] {
    const cmd = [...suggestedCmd];
    cmd.push(pc.command.proxyCmd);
    if (pc.arguments) {
      for (const arg of Object.entries(pc.arguments)) {
        const [name, value] = arg;
        cmd.push(name, value);
      }
    }
    return cmd;
  }

  prepareShellCmdEnvVars(
    pc: CommandProxyPluginContext<PE>,
    envVarsPrefix: string,
  ): Record<string, string> {
    const result: Record<string, string> = {
      [`${envVarsPrefix}PLUGIN_SRC`]: pc.plugin.source.systemID,
      [`${envVarsPrefix}PLUGIN_SRC_FRIENDLY`]: pc.plugin.source.friendlyName,
      [`${envVarsPrefix}PLUGIN_SRC_ABBREV`]: pc.plugin.source.abbreviatedName,
      [`${envVarsPrefix}COMMAND`]: pc.command.proxyCmd,
    };
    if (pc.arguments) {
      if (Object.keys(pc.arguments).length > 0) {
        result.PUBCTLHOOK_ARGS_JSON = JSON.stringify(
          pc.arguments,
        );
      }
    }
    return result;
  }

  createExecutePluginContext(
    command: ProxyableCommand,
    plugin: fr.Plugin,
    options?: {
      readonly onActivity?: CommandProxyPluginActivityReporter;
    },
  ): CPPC {
    const pc: CPPC = {
      container: this.executive,
      plugin,
      command,
    } as CPPC; // TODO: figure out why typecasting is required, was getting error
    return options?.onActivity
      ? {
        ...pc,
        onActivity: options?.onActivity,
      }
      : {
        ...pc,
        onActivity: (
          a: CommandProxyPluginActivity,
        ): CommandProxyPluginActivity => {
          console.log(a.message);
          return a;
        },
      };
  }

  async execute(
    command: ProxyableCommand,
    options?: {
      readonly onActivity?: CommandProxyPluginActivityReporter;
      readonly onUnhandledPlugin?: (pc: CPPC) => void;
    },
  ): Promise<AR[]> {
    const results: AR[] = [];
    for (const plugin of this.plugins) {
      const cppc = this.createExecutePluginContext(command, plugin, options);
      if (fr.isActionPlugin<PE, CPPC, AR>(plugin)) {
        results.push(await plugin.execute(cppc));
      } else if (
        fr.isActionSyncPlugin<PE, CPPC, AR>(plugin)
      ) {
        results.push(plugin.executeSync(cppc));
      } else if (options?.onUnhandledPlugin) {
        options?.onUnhandledPlugin(cppc);
      }
    }
    return results;
  }
}
