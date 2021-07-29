import { safety, shell } from "./deps.ts";
import * as fr from "./framework.ts";

export interface ShellCmdEnvVarsSupplier<PE extends fr.PluginExecutive> {
  (pc: fr.PluginContext<PE>): Record<string, string>;
}

export interface ShellCmdEnhancer<PE extends fr.PluginExecutive> {
  (pc: fr.PluginContext<PE>, suggestedCmd: string[]): string[];
}

export interface PrepareShellCmdRunOptions<PE extends fr.PluginExecutive> {
  (pc: fr.PluginContext<PE>): shell.RunShellCommandOptions;
}

export interface ShellExePlugin<PE extends fr.PluginExecutive>
  extends fr.Plugin, fr.Action<PE> {
  readonly shellCmd: (pc: fr.PluginContext<PE>) => string[];
  readonly envVars?: (pc: fr.PluginContext<PE>) => Record<string, string>;
}

export function isShellExePlugin<PE extends fr.PluginExecutive>(
  o: unknown,
): o is ShellExePlugin<PE> {
  if (fr.isPlugin(o)) {
    const isShellExPlugin = safety.typeGuard<ShellExePlugin<PE>>(
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
