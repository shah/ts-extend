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

// deno-lint-ignore no-empty-interface
export interface CommandProxyPluginsSupplier<PE extends fr.PluginExecutive>
  extends fr.PluginsSupplier<PE> {
}

export interface CommandProxyPluginsManagerOptions<
  PE extends fr.PluginExecutive,
> {
  readonly shellCmdEnvVarsSupplier?: shExtn.ShellCmdEnvVarsSupplier<PE>;
  readonly shellCmdEnvVarsDefaultPrefix?: string;
  readonly shellCmdEnhancer?: shExtn.ShellCmdEnhancer<PE>;
  readonly shellCmdPrepareRunOpts?: shExtn.PrepareShellCmdRunOptions<PE>;
  readonly typeScriptModuleOptions?: tsExtn.TypeScriptRegistrarOptions<PE>;
}

export class CommandProxyPluginsManager<PE extends fr.PluginExecutive>
  implements CommandProxyPluginsSupplier<PE> {
  readonly plugins: fr.Plugin[] = [];
  readonly validInactivePlugins: fr.ValidPluginRegistration[] = [];
  readonly pluginsGraph: fr.PluginsGraph = new cxg.CxGraph();
  readonly invalidPlugins: fr.InvalidPluginRegistration[] = [];

  constructor(
    readonly executive: PE,
    readonly commands: Record<ProxyableCommandText, ProxyableCommand>,
    readonly options: CommandProxyPluginsManagerOptions<PE>,
  ) {
  }

  protected async init(): Promise<void> {
  }

  async activate(): Promise<void> {
    await this.init();
    for (const vpr of this.validInactivePlugins) {
      const ac: fr.ActivateContext<
        PE,
        fr.PluginContext<PE>,
        fr.PluginsSupplier<PE>
      > = {
        context: { container: this.executive, plugin: vpr.plugin },
        supplier: this,
        vpr,
      };
      if (fr.isActivatablePlugin<PE>(ac.vpr.plugin)) {
        (ac.vpr.plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Activating;
        const activatedPR = await ac.vpr.plugin.activate(ac);
        if (fr.isValidPluginRegistration(activatedPR.registration)) {
          this.plugins.push(ac.vpr.plugin);
        } else {
          this.handleInvalidPlugin(activatedPR.registration);
        }
        (ac.vpr.plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Active;
      } else if (fr.isActivatableSyncPlugin<PE>(ac.vpr.plugin)) {
        (ac.vpr.plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Activating;
        const activatedPR = ac.vpr.plugin.activateSync(ac);
        if (fr.isValidPluginRegistration(activatedPR.registration)) {
          this.plugins.push(ac.vpr.plugin);
        } else {
          this.handleInvalidPlugin(activatedPR.registration);
        }
        (ac.vpr.plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Active;
      } else {
        // not a typescript module or no activation hook requested, no special activation
        this.plugins.push(ac.vpr.plugin);
      }
    }
  }

  async deactivate(): Promise<void> {
    for (const plugin of this.plugins) {
      const dac: fr.DeactivateContext<
        PE,
        fr.PluginContext<PE>,
        this
      > = {
        context: { container: this.executive, plugin },
        supplier: this,
      };
      if (fr.isActivatablePlugin(plugin)) {
        (plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Deactivating;
        await plugin.deactivate(dac);
        (plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Inactive;
      } else if (fr.isActivatableSyncPlugin(plugin)) {
        (plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Activating;
        plugin.deactivateSync(dac);
        (plugin.activationState as fr.PluginActivationState) =
          fr.PluginActivationState.Inactive;
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
  ): CommandProxyPluginContext<PE> & {
    readonly onActivity?: CommandProxyPluginActivityReporter;
  } {
    const pc: CommandProxyPluginContext<PE> = {
      container: this.executive,
      plugin,
      command,
    };
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
      readonly onUnhandledPlugin?: (pc: CommandProxyPluginContext<PE>) => void;
    },
  ): Promise<fr.ActionResult<PE, fr.PluginContext<PE>>[]> {
    const results: fr.ActionResult<PE, fr.PluginContext<PE>>[] = [];
    for (const plugin of this.plugins) {
      const cppc = this.createExecutePluginContext(command, plugin, options);
      if (
        fr.isActionPlugin<PE>(plugin)
      ) {
        results.push(await plugin.execute(cppc));
      } else if (
        fr.isActionSyncPlugin<PE>(plugin)
      ) {
        results.push(plugin.executeSync(cppc));
      } else if (options?.onUnhandledPlugin) {
        options?.onUnhandledPlugin(cppc);
      }
    }
    return results;
  }
}
