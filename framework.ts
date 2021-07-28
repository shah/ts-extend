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

export interface PluginExecutiveContext<PE extends PluginExecutive> {
  readonly container: PE;
}

export interface PluginContext<PE extends PluginExecutive>
  extends PluginExecutiveContext<PE> {
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

export interface ActivateContext<
  PE extends PluginExecutive,
  PEC extends PluginExecutiveContext<PE>,
  PS extends PluginsSupplier,
> {
  readonly context: PEC;
  readonly supplier: PS;
  readonly vpr: ValidPluginRegistration;
}

export interface ActivateResult<
  PE extends PluginExecutive,
  PEC extends PluginExecutiveContext<PE>,
  PS extends PluginsSupplier,
  AC extends ActivateContext<PE, PEC, PS>,
> {
  readonly context: AC;
  readonly registration: ValidPluginRegistration | InvalidPluginRegistration;
}

export interface Activatable<
  PE extends PluginExecutive,
  PEC extends PluginExecutiveContext<PE>,
  PS extends PluginsSupplier,
  AC extends ActivateContext<PE, PEC, PS>,
  AR extends ActivateResult<PE, PEC, PS, AC>,
> {
  readonly activate: (ac: AC) => Promise<AR>;
}

export interface ActivatableSync<
  PE extends PluginExecutive,
  PEC extends PluginExecutiveContext<PE>,
  PS extends PluginsSupplier,
  AC extends ActivateContext<PE, PEC, PS>,
  AR extends ActivateResult<PE, PEC, PS, AC>,
> {
  readonly activateSync: (ac: AC) => AR;
}

export function isActivatablePlugin<
  PE extends PluginExecutive,
  PEC extends PluginExecutiveContext<PE>,
  PS extends PluginsSupplier,
  AC extends ActivateContext<PE, PEC, PS>,
  AR extends ActivateResult<PE, PEC, PS, AC>,
>(
  o: unknown,
): o is Plugin & Activatable<PE, PEC, PS, AC, AR> {
  if (isPlugin(o)) {
    return "activate" in o;
  }
  return false;
}

export function isActivatableSyncPlugin<
  PE extends PluginExecutive,
  PEC extends PluginExecutiveContext<PE>,
  PS extends PluginsSupplier,
  AC extends ActivateContext<PE, PEC, PS>,
  AR extends ActivateResult<PE, PEC, PS, AC>,
>(
  o: unknown,
): o is Plugin & ActivatableSync<PE, PEC, PS, AC, AR> {
  if (isPlugin(o)) {
    return "activateSync" in o;
  }
  return false;
}

export interface ActionResult<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
> {
  readonly context: PC;
}

export interface Action<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  AR extends ActionResult<PE, PC>,
> {
  readonly execute: (pc: PC) => Promise<AR>;
}

export interface ActionSync<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  AR extends ActionResult<PE, PC>,
> {
  readonly executeSync: (pc: PC) => AR;
}

export function isActionPlugin<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  AR extends ActionResult<PE, PC>,
>(
  o: unknown,
): o is Plugin & Action<PE, PC, AR> {
  if (isPlugin(o)) {
    return "execute" in o;
  }
  return false;
}

export function isActionSyncPlugin<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  AR extends ActionResult<PE, PC>,
>(
  o: unknown,
): o is Plugin & ActionSync<PE, PC, AR> {
  if (isPlugin(o)) {
    return "executeSync" in o;
  }
  return false;
}

export interface FilterResult<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
> {
  readonly context: PC;
}

export interface Filter<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  FR extends FilterResult<PE, PC>,
> {
  readonly filter: (pc: PC) => Promise<FR>;
}

export function isFilterPlugin<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  FR extends FilterResult<PE, PC>,
>(
  o: unknown,
): o is Plugin & Filter<PE, PC, FR> {
  if (isPlugin(o)) {
    return "filter" in o;
  }
  return false;
}
