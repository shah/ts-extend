import { safety, shell } from "./deps.ts";
import * as fr from "./framework.ts";

export interface ShellCmdEnvVarsSupplier<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> {
  (pc: PC): Record<string, string>;
}

export interface ShellCmdEnhancer<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> {
  (pc: PC, suggestedCmd: string[]): string[];
}

export interface PrepareShellCmdRunOptions<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> {
  (pc: PC): shell.RunShellCommandOptions;
}

export interface ShellExePlugin<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
  AR extends ShellExeActionResult<PE, PC>,
> extends fr.Plugin, fr.Action<PE, PC, AR> {
  readonly shellCmd: (pc: PC) => string[];
  readonly envVars?: (pc: PC) => Record<string, string>;
}

export function isShellExePlugin<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
  AR extends ShellExeActionResult<PE, PC>,
>(
  o: unknown,
): o is ShellExePlugin<PE, PC, AR> {
  if (fr.isPlugin(o)) {
    const isShellExPlugin = safety.typeGuard<ShellExePlugin<PE, PC, AR>>(
      "shellCmd",
      "envVars",
    );
    return isShellExPlugin(o);
  }
  return false;
}

export interface ShellExeActionResult<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> extends fr.ActionResult<PE, PC> {
  readonly rscResult: shell.RunShellCommandResult;
}

export function isShellExeActionResult<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
>(
  o: unknown,
): o is ShellExeActionResult<PE, PC> {
  const isActionResult = safety.typeGuard<ShellExeActionResult<PE, PC>>(
    "rscResult",
  );
  return isActionResult(o);
}
