import { govnSvcTelemetry as telem, safety, shell } from "./deps.ts";
import * as fr from "./framework.ts";

export interface ShellExePluginSupplier extends fr.PluginSupplier {
  readonly plugin: ShellExePlugin;
}

export interface ShellCmdEnvVarsSupplier {
  (sps: ShellExePluginSupplier): Record<string, string>;
}

export interface ShellCmdEnhancer {
  (sps: ShellExePluginSupplier, suggestedCmd: string[]): string[];
}

export interface PrepareShellCmdRunOptions {
  (sps: ShellExePluginSupplier): shell.RunShellCommandOptions;
}

export interface ShellExeActionTelemetry extends telem.Instrumentation {
  readonly execute: (cmd: string[]) => telem.Instrumentable;
}

export class TypicalShellExeActionTelemetry implements ShellExeActionTelemetry {
  readonly instruments: telem.Instrument[];
  readonly prepareInstrument: (
    options?: telem.InstrumentationOptions,
  ) => telem.Instrumentable;

  constructor(readonly parent: telem.Instrumentation) {
    this.instruments = parent.instruments;
    this.prepareInstrument = parent.prepareInstrument;
  }

  execute(cmd: string[]): telem.Instrumentable {
    return this.prepareInstrument({
      identity: "ShellExeActionTelemetry.execute",
      baggage: { cmd: cmd },
    });
  }
}

export interface ShellExeActionOptions {
  readonly envVarsSupplier?: ShellCmdEnvVarsSupplier;
  readonly shellCmdEnhancer?: ShellCmdEnhancer;
  readonly runShellCmdOpts?: PrepareShellCmdRunOptions;
}

export interface ShellExeActionContext<PM extends fr.PluginsManager>
  extends fr.PluginsManagerSupplier<PM> {
  readonly telemetry: ShellExeActionTelemetry;
  readonly options: ShellExeActionOptions;
}

export interface ShellExeActionResult {
  readonly rscResult: shell.RunShellCommandResult;
}

export const isShellExeActionResult = safety.typeGuard<ShellExeActionResult>(
  "rscResult",
);

export interface ShellExePlugin extends fr.Plugin {
  readonly execute: (
    seac: ShellExeActionContext<fr.PluginsManager>,
  ) => Promise<ShellExeActionResult>;
}

export const isShellExePlugin = safety.typeGuard<ShellExePlugin>(
  "execute",
  "nature",
  "source",
);
