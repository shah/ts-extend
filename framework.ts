import { cxg, safety } from "./deps.ts";

export type PluginExecutive = unknown;

export type PluginNatureIdentity = string;

/**
 * MutableOptionalPluginNature is useful during the initialization process of
 * plugins but should not be used after initialization.
 */
export interface MutableOptionalPluginNature {
  identity?: PluginNatureIdentity;
}

export type PluginNature = Readonly<Required<MutableOptionalPluginNature>>;

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

export type PluginGraphNode = cxg.Node<Plugin>;
export type PluginsGraph = cxg.CxGraph;

export interface PluginsSupplier {
  readonly plugins: Plugin[];
  readonly pluginsGraph: PluginsGraph;
}

export interface PluginContext<PE extends PluginExecutive> {
  readonly container: PE;
  readonly plugin: Plugin;
}

export function isPluginContext<T extends PluginExecutive>(
  o: unknown,
): o is PluginContext<T> {
  const isPC = safety.typeGuard<PluginContext<T>>(
    "container",
    "plugin",
  );
  return isPC(o);
}

export type PluginIdentity = string;
export type PluginGraphNodeIdentity = string;

/**
 * MutableOptionalPluginSource is useful during the initialization process of
 * plugins but should not be used after initialization.
 */
export interface MutableOptionalPluginSource {
  systemID?: PluginIdentity;
  friendlyName?: PluginIdentity;
  abbreviatedName?: PluginIdentity;
  graphNodeName?: PluginGraphNodeIdentity;
}

export type PluginSource = Readonly<Required<MutableOptionalPluginSource>>;

export const isPluginSource = safety.typeGuard<PluginSource>(
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
);

export interface MutableOptionalPluginsGraphParticipant {
  registerNode?: (graph: PluginsGraph) => PluginGraphNode;
}

export interface Plugin
  extends Readonly<Required<MutableOptionalPluginsGraphParticipant>> {
  readonly nature: PluginNature;
  readonly source: PluginSource;
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
