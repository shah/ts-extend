import * as actv from "./activity.ts";
import { safety } from "./deps.ts";

// deno-lint-ignore no-empty-interface
export interface PluginExecutive {
}

export type PluginNatureIdentity = string;

export interface PluginNature {
  readonly identity: PluginNatureIdentity;
}

export interface PluginRegistrationIssue {
  readonly source: PluginSource;
  readonly diagnostics: (Error | string)[];
}

export interface PluginRegistration {
  readonly source: PluginSource;
}

export interface ValidPluginRegistration extends PluginRegistration {
  readonly plugin: Plugin;
}

export const isValidPluginRegistration = safety.typeGuard<
  ValidPluginRegistration
>(
  "plugin",
);

export interface InvalidPluginRegistration extends PluginRegistration {
  readonly issues: PluginRegistrationIssue[];
}

export const isInvalidPluginRegistration = safety.typeGuard<
  InvalidPluginRegistration
>(
  "source",
  "issues",
);

export interface PluginRegistrar {
  (src: PluginSource): Promise<PluginRegistration>;
}

export interface PluginRegistrarSync {
  (src: PluginSource): PluginRegistration;
}

export interface PluginsSupplier {
  readonly plugins: Plugin[];
}

export interface PluginActivityReporter {
  (a: actv.PluginActivity, options?: { dryRun?: boolean }): void;
}

export interface PluginContext<T extends PluginExecutive> {
  readonly container: T;
  readonly plugin: Plugin;
  readonly onActivity?: PluginActivityReporter;
}

export function isPluginContext<T extends PluginExecutive>(
  o: unknown,
): o is PluginContext<T> {
  const isPC = safety.typeGuard<PluginContext<T>>(
    "container",
    "plugin",
    "onActivity",
  );
  return isPC(o);
}

export type PluginIdentity = string;

export interface PluginSource {
  readonly systemID: PluginIdentity;
  readonly friendlyName: PluginIdentity;
}

export const isPluginSource = safety.typeGuard<PluginSource>(
  "systemID",
  "friendlyName",
);

export interface Plugin {
  readonly nature: PluginNature;
  readonly source: PluginSource;
}

export const isPlugin = safety.typeGuard<Plugin>("nature", "source");

export interface ActionResult<T extends PluginExecutive> {
  readonly pc: PluginContext<T>;
}

export interface Action<T extends PluginExecutive> {
  readonly execute: (pc: PluginContext<T>) => Promise<ActionResult<T>>;
}

export function isActionPlugin<T extends PluginExecutive>(
  o: unknown,
): o is Plugin & Action<T> {
  if (isPlugin(o)) {
    return "execute" in o;
  }
  return false;
}

export interface FilterResult<T extends PluginExecutive> {
  readonly pc: PluginContext<T>;
}

export interface Filter<T extends PluginExecutive> {
  readonly filter: (pc: PluginContext<T>) => Promise<FilterResult<T>>;
}

export function isFilterPlugin<T extends PluginExecutive>(
  o: unknown,
): o is Plugin & Filter<T> {
  if (isPlugin(o)) {
    return "filter" in o;
  }
  return false;
}
