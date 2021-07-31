import { cxg, safety } from "./deps.ts";

export interface PluginExecutive {
  readonly isPluginExecutive: true;
}

export const isPluginExecutive = safety.typeGuard<PluginExecutive>(
  "isPluginExecutive",
);

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

export interface PluginsSupplier<PE extends PluginExecutive> {
  readonly plugins: Plugin[];
  readonly pluginsGraph: PluginsGraph;
  readonly activate: (executive: PE) => Promise<void>;
  readonly deactivate: (executive: PE) => Promise<void>;
}

export function isPluginsSupplier<PE extends PluginExecutive>(
  o: unknown,
): o is PluginsSupplier<PE> {
  const isPS = safety.typeGuard<PluginsSupplier<PE>>(
    "plugins",
    "pluginsGraph",
    "activate",
  );
  return isPS(o);
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

export interface Plugin {
  readonly nature: PluginNature;
  readonly source: PluginSource;
}

export const isPlugin = safety.typeGuard<Plugin>(
  "nature",
  "source",
);

export enum PluginActivationState {
  Inactive = 0,
  Active,
  Activating,
  Deactivating,
}

export interface ActivateContext<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  PS extends PluginsSupplier<PE>,
> {
  readonly context: PC;
  readonly supplier: PS;
  readonly vpr: ValidPluginRegistration;
}

export interface DeactivateContext<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
  PS extends PluginsSupplier<PE>,
> {
  readonly context: PC;
  readonly supplier: PS;
}

export interface ActivateResult {
  readonly registration: ValidPluginRegistration | InvalidPluginRegistration;
}

export interface Activatable<PE extends PluginExecutive> {
  readonly activationState: PluginActivationState;
  readonly activate: (
    ac: ActivateContext<PE, PluginContext<PE>, PluginsSupplier<PE>>,
  ) => Promise<ActivateResult>;
  readonly deactivate: (
    ac: DeactivateContext<PE, PluginContext<PE>, PluginsSupplier<PE>>,
  ) => Promise<void>;
}

export interface ActivatableSync<PE extends PluginExecutive> {
  readonly activationState: PluginActivationState;
  readonly activateSync: (
    ac: ActivateContext<PE, PluginContext<PE>, PluginsSupplier<PE>>,
  ) => ActivateResult;
  readonly deactivateSync: (
    ac: DeactivateContext<PE, PluginContext<PE>, PluginsSupplier<PE>>,
  ) => void;
}

export function isActivatablePlugin<PE extends PluginExecutive>(
  o: unknown,
): o is Plugin & Activatable<PE> {
  if (isPlugin(o)) {
    return "activate" in o && "deactivate" in o;
  }
  return false;
}

export function isActivatableSyncPlugin<PE extends PluginExecutive>(
  o: unknown,
): o is Plugin & ActivatableSync<PE> {
  if (isPlugin(o)) {
    return "activateSync" in o && "deactivateSync" in o;
  }
  return false;
}

export interface ActionResult<
  PE extends PluginExecutive,
  PC extends PluginContext<PE>,
> {
  readonly context: PC;
}

export interface Action<PE extends PluginExecutive> {
  readonly execute: (
    pc: PluginContext<PE>,
  ) => Promise<ActionResult<PE, PluginContext<PE>>>;
}

export interface ActionSync<PE extends PluginExecutive> {
  readonly executeSync: (
    pc: PluginContext<PE>,
  ) => ActionResult<PE, PluginContext<PE>>;
}

export function isActionPlugin<PE extends PluginExecutive>(
  o: unknown,
): o is Plugin & Action<PE> {
  if (isPlugin(o)) {
    return "execute" in o;
  }
  return false;
}

export function isActionSyncPlugin<PE extends PluginExecutive>(
  o: unknown,
): o is Plugin & ActionSync<PE> {
  if (isPlugin(o)) {
    return "executeSync" in o;
  }
  return false;
}
