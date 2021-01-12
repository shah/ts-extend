import { safety as shExtn } from "./deps.ts";
import * as fr from "./framework.ts";

export interface ShellExePlugin<T extends fr.PluginExecutive>
  extends fr.Plugin, fr.Action<T> {
  readonly shellCmd: (pc: fr.PluginContext<T>) => string[];
  readonly envVars?: (pc: fr.PluginContext<T>) => Record<string, string>;
}

export function isShellExePlugin<T extends fr.PluginExecutive>(
  o: unknown,
): o is ShellExePlugin<T> {
  if (fr.isPlugin(o)) {
    const isShellExPlugin = shExtn.typeGuard<ShellExePlugin<T>>(
      "shellCmd",
      "envVars",
    );
    return isShellExPlugin(o);
  }
  return false;
}
