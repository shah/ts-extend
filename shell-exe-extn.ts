import { safety, shell } from "./deps.ts";
import * as fr from "./framework.ts";

export interface ShellCmdEnvVarsSupplier<T extends fr.PluginExecutive> {
  (pc: fr.PluginContext<T>): Record<string, string>;
}

export interface ShellCmdEnhancer<T extends fr.PluginExecutive> {
  (pc: fr.PluginContext<T>, suggestedCmd: string[]): string[];
}

export interface PrepareShellCmdRunOptions<T extends fr.PluginExecutive> {
  (pc: fr.PluginContext<T>): shell.RunShellCommandOptions;
}

export interface ShellExePlugin<T extends fr.PluginExecutive>
  extends fr.Plugin, fr.Action<T> {
  readonly shellCmd: (pc: fr.PluginContext<T>) => string[];
  readonly envVars?: (pc: fr.PluginContext<T>) => Record<string, string>;
}

export function isShellExePlugin<T extends fr.PluginExecutive>(
  o: unknown,
): o is ShellExePlugin<T> {
  if (fr.isPlugin(o)) {
    const isShellExPlugin = safety.typeGuard<ShellExePlugin<T>>(
      "shellCmd",
      "envVars",
    );
    return isShellExPlugin(o);
  }
  return false;
}

export interface ShellExeActionResult<T extends fr.PluginExecutive>
  extends fr.ActionResult<T> {
  readonly rscResult: shell.RunShellCommandResult;
}

export function isShellExeActionResult<T extends fr.PluginExecutive>(
  o: unknown,
): o is ShellExeActionResult<T> {
  const isActionResult = safety.typeGuard<ShellExeActionResult<T>>(
    "rscResult",
  );
  return isActionResult(o);
}
