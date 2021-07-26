import { cxg, safety } from "./deps.ts";
import * as actv from "./activity.ts";

export type PluginExecutive = unknown;

export type PluginNatureIdentity = string;

export interface PluginNature {
  readonly identity: PluginNatureIdentity;
}

export const isPluginNature = safety.typeGuard<PluginNature>("identity");

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
  readonly pluginsGraph: cxg.CxGraph;
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
export type PluginGraphNodeIdentity = string;

export interface PluginSource {
  readonly systemID: PluginIdentity;
  readonly friendlyName: PluginIdentity;
  readonly abbreviatedName: PluginIdentity;
  readonly graphNodeName: PluginGraphNodeIdentity;
}

export const isPluginSource = safety.typeGuard<PluginSource>(
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
);

export interface Plugin {
  readonly nature: PluginNature;
  readonly source: PluginSource;
  readonly registerNode: (graph: cxg.CxGraph) => cxg.Node<Plugin>;
}

export const isPlugin = safety.typeGuard<Plugin>(
  "nature",
  "source",
  "registerNode",
);

export interface ActionResult<
  T extends PluginExecutive,
  PC extends PluginContext<T>,
> {
  readonly pc: PC;
}

export interface Action<
  T extends PluginExecutive,
  PC extends PluginContext<T>,
> {
  readonly execute: (pc: PC) => Promise<ActionResult<T, PC>>;
}

export function isActionPlugin<
  T extends PluginExecutive,
  PC extends PluginContext<T>,
>(
  o: unknown,
): o is Plugin & Action<T, PC> {
  if (isPlugin(o)) {
    return "execute" in o;
  }
  return false;
}

export interface FilterResult<
  T extends PluginExecutive,
  PC extends PluginContext<T>,
> {
  readonly pc: PC;
}

export interface Filter<
  T extends PluginExecutive,
  PC extends PluginContext<T>,
> {
  readonly filter: (pc: PC) => Promise<FilterResult<T, PC>>;
}

export function isFilterPlugin<
  T extends PluginExecutive,
  PC extends PluginContext<T>,
>(
  o: unknown,
): o is Plugin & Filter<T, PC> {
  if (isPlugin(o)) {
    return "filter" in o;
  }
  return false;
}
