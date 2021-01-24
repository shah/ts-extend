import { safety } from "./deps.ts";
import * as actv from "./activity.ts";
import * as fr from "./framework.ts";
import * as shExtn from "./shell-exe-extn.ts";
import * as tsExtn from "./typescript-extn.ts";

export type ProxyableCommandText = string;

export interface ProxyableCommand {
  readonly proxyCmd: ProxyableCommandText;
}

export interface DryRunnableProxyableCommand {
  readonly isDryRun: boolean;
}

export const isCommandDryRunnable = safety.typeGuard<
  DryRunnableProxyableCommand
>("isDryRun");

export interface CommandProxyPluginContext<T extends fr.PluginExecutive>
  extends fr.PluginContext<T> {
  readonly command: ProxyableCommand;
  readonly arguments?: Record<string, string>;
}

export function isCommandProxyPluginContext<T extends fr.PluginExecutive>(
  o: unknown,
): o is CommandProxyPluginContext<T> {
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
  T extends fr.PluginExecutive,
>(
  cppc: CommandProxyPluginContext<T>,
  dfmhResult?: tsExtn.DenoFunctionModuleHandlerResult,
): tsExtn.DenoFunctionModuleHandlerResult {
  if (!dfmhResult) return {};
  return dfmhResult;
}

export interface CommandProxyPluginsManagerOptions<
  T extends fr.PluginExecutive,
> {
  readonly shellCmdEnvVarsSupplier?: shExtn.ShellCmdEnvVarsSupplier<T>;
  readonly shellCmdEnvVarsDefaultPrefix?: string;
  readonly shellCmdEnhancer?: shExtn.ShellCmdEnhancer<T>;
  readonly shellCmdPrepareRunOpts?: shExtn.PrepareShellCmdRunOptions<T>;
  readonly typeScriptModuleOptions?: tsExtn.TypeScriptRegistrarOptions;
}

export class CommandProxyPluginsManager<T extends fr.PluginExecutive>
  implements fr.PluginsSupplier {
  readonly plugins: fr.Plugin[] = [];
  readonly invalidPlugins: fr.InvalidPluginRegistration[] = [];

  constructor(
    readonly executive: T,
    readonly commands: Record<ProxyableCommandText, ProxyableCommand>,
    readonly options: CommandProxyPluginsManagerOptions<T>,
  ) {
  }

  async init(): Promise<void> {
  }

  registerValidPlugin(vpr: fr.ValidPluginRegistration): fr.Plugin {
    // TODO: make sure not to register duplicates; if it's a duplicate,
    // do not add, just return the existing one
    this.plugins.push(vpr.plugin);
    return vpr.plugin;
  }

  handleInvalidPlugin(
    ipr: fr.InvalidPluginRegistration,
  ): fr.InvalidPluginRegistration {
    this.invalidPlugins.push(ipr);
    return ipr;
  }

  enhanceShellCmd(
    pc: CommandProxyPluginContext<T>,
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
    pc: CommandProxyPluginContext<T>,
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
      readonly onActivity?: fr.PluginActivityReporter;
    },
  ): CommandProxyPluginContext<T> {
    return {
      onActivity: options?.onActivity ||
        ((a: actv.PluginActivity): actv.PluginActivity => {
          console.log(a.message);
          return a;
        }),
      container: this.executive,
      plugin,
      command,
    };
  }

  async execute(
    command: ProxyableCommand,
    options?: {
      readonly onActivity?: fr.PluginActivityReporter;
      readonly onUnhandledPlugin?: (cppc: CommandProxyPluginContext<T>) => void;
    },
  ): Promise<fr.ActionResult<T>[]> {
    const results: fr.ActionResult<T>[] = [];
    for (const plugin of this.plugins) {
      const cppc = this.createExecutePluginContext(command, plugin, options);
      if (fr.isActionPlugin<T>(plugin)) {
        results.push(await plugin.execute(cppc));
      } else if (options?.onUnhandledPlugin) {
        options?.onUnhandledPlugin(cppc);
      }
    }
    return results;
  }
}
