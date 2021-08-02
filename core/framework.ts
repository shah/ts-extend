import { cxg, safety } from "./deps.ts";

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

export interface PluginRegistrarSourceApplicability {
  readonly isApplicable: boolean;
  readonly redirectSource?: PluginSource;
  readonly alternateRegistrar?: PluginRegistrar;
}

export interface PluginGuard<P extends Plugin> {
  readonly guard: (o: unknown) => o is P;
  readonly guardFailureDiagnostic: (o: unknown) => string;
}

export interface PluginRegistrationOptions {
  readonly nature?: (suggested: PluginNature) => PluginNature;
  readonly transform?: (
    acquired: ValidPluginRegistration,
  ) => ValidPluginRegistration;
  readonly guard?: PluginGuard<Plugin>;
  readonly graphNode?: (
    plugin: Plugin,
    suggested?: PluginGraphNode,
  ) => PluginGraphNode;
}

export type PluginRegistrarIdentity = string;

export interface PluginRegistrar {
  readonly registrarID: PluginRegistrarIdentity;
  readonly pluginApplicability: (
    src: PluginSource,
  ) => Promise<PluginRegistrarSourceApplicability>;
  readonly pluginRegistration: (
    src: PluginSource,
    onInvalid: (
      src: PluginSource,
      suggested?: InvalidPluginRegistration,
    ) => Promise<PluginRegistration>,
    options?: PluginRegistrationOptions,
  ) => Promise<PluginRegistration>;
}

export type PluginGraphNode = cxg.Node<Plugin>;
export type PluginsGraph = cxg.CxGraph;

export interface PluginsManagerActivationContext {
  readonly pluginsAcquirers: InactivePluginsSupplier[];
  readonly beforeActivate?: (
    ac: ActivateContext<PluginsManager>,
  ) => Promise<void>;
  readonly afterActivate?: (plugin: Plugin) => Promise<void>;
}

export interface PluginsManagerDeactivationContext {
  readonly beforeDeactivate?: (
    dac: DeactivateContext<PluginsManager>,
  ) => Promise<void>;
  readonly afterDeactivate?: (
    dac: DeactivateContext<PluginsManager>,
  ) => Promise<void>;
}

export interface PluginsManager {
  readonly plugins: Plugin[];
  readonly pluginsGraph: PluginsGraph;
  readonly activate: (pmac: PluginsManagerActivationContext) => Promise<void>;
  readonly deactivate: (
    pmdc: PluginsManagerDeactivationContext,
  ) => Promise<void>;
}

export function isPluginsManager(
  o: unknown,
): o is PluginsManager {
  const isPS = safety.typeGuard<PluginsManager>(
    "plugins",
    "pluginsGraph",
    "activate",
    "deactivate",
  );
  return isPS(o);
}

export interface PluginsManagerSupplier<PM extends PluginsManager> {
  readonly pluginsManager: PM;
}

export type PluginIdentity = string;
export type PluginGraphNodeIdentity = string;

/**
 * MutableOptionalPluginSource is useful during the initialization process of
 * plugins but should not be used after initialization.
 */
export interface MutableOptionalPluginSource {
  registrarID?: PluginRegistrarIdentity;
  systemID?: PluginIdentity;
  friendlyName?: PluginIdentity;
  abbreviatedName?: PluginIdentity;
  graphNodeName?: PluginGraphNodeIdentity;
}

export type PluginSource = Readonly<Required<MutableOptionalPluginSource>>;

export const isPluginSource = safety.typeGuard<PluginSource>(
  "registrarID",
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
);

export interface Plugin {
  readonly nature: PluginNature;
  readonly source: PluginSource;
}

export interface PluginSupplier {
  readonly plugin: Plugin;
}

export const isPlugin = safety.typeGuard<Plugin>(
  "nature",
  "source",
);

export interface PluginGraphNodeSupplier {
  readonly graphNode: PluginGraphNode;
}

export const isPluginGraphNodeSupplier = safety.typeGuard<
  PluginGraphNodeSupplier
>("graphNode");

export interface PluginGraphContributor {
  readonly activateGraphNode: (graph: PluginsGraph) => PluginGraphNode;
  readonly deactivateGraphNode?: (graph: PluginsGraph) => void;
}

export const isPluginGraphContributor = safety.typeGuard<
  PluginGraphContributor
>("activateGraphNode");

export enum PluginActivationState {
  Unknown = 0,
  Active,
  Inactive,
}

export interface ActivateContext<PM extends PluginsManager>
  extends PluginsManagerSupplier<PM> {
  readonly vpr: ValidPluginRegistration;
}

export interface DeactivateContext<PM extends PluginsManager>
  extends PluginsManagerSupplier<PM> {
  readonly plugin: Plugin;
}

export interface MutableActivationStateSupplier {
  activationState: PluginActivationState;
}

export interface ActivateResult
  extends Readonly<MutableActivationStateSupplier> {
  readonly registration: ValidPluginRegistration | InvalidPluginRegistration;
}

export interface Activatable<
  PM extends PluginsManager,
  AC extends ActivateContext<PM>,
  DC extends DeactivateContext<PM>,
> extends Readonly<MutableActivationStateSupplier> {
  readonly activationState: PluginActivationState;
  readonly activate: (ac: AC) => Promise<ActivateResult>;
  readonly deactivate: (dc: DC) => Promise<void>;
}

export interface ActivatableSync<
  PM extends PluginsManager,
  AC extends ActivateContext<PM>,
  DC extends DeactivateContext<PM>,
> {
  readonly activationState: PluginActivationState;
  readonly activateSync: (ac: AC) => ActivateResult;
  readonly deactivateSync: (ac: DC) => void;
}

export function isActivatablePlugin<
  PM extends PluginsManager,
>(
  o: unknown,
): o is Plugin & Activatable<PM, ActivateContext<PM>, DeactivateContext<PM>> {
  if (isPlugin(o)) {
    return "activate" in o && "deactivate" in o && "activationState" in o;
  }
  return false;
}

export function isActivatableSyncPlugin<
  PM extends PluginsManager,
>(
  o: unknown,
): o is
  & Plugin
  & ActivatableSync<PM, ActivateContext<PM>, DeactivateContext<PM>> {
  if (isPlugin(o)) {
    return "activateSync" in o && "deactivateSync" in o &&
      "activationState" in o;
  }
  return false;
}

export interface InactivePluginsSupplier {
  readonly validInactivePlugins: ValidPluginRegistration[];
  readonly invalidPlugins: InvalidPluginRegistration[];
}

export abstract class TypicalPluginsManager implements PluginsManager {
  readonly plugins: Plugin[] = [];
  readonly pluginsGraph: PluginsGraph = new cxg.CxGraph();
  readonly invalidPlugins: InvalidPluginRegistration[] = [];

  constructor() {
  }

  async activate(pmac: PluginsManagerActivationContext): Promise<void> {
    const activate = (ar: ActivateResult) => {
      if (isValidPluginRegistration(ar.registration)) {
        this.plugins.push(ar.registration.plugin);
        // the ActivatablePlugin is immutable for others, but we're special
        ((ar.registration
          .plugin as unknown) as MutableActivationStateSupplier)
          .activationState = ar.activationState;
      } else {
        this.invalidPlugins.push(ar.registration);
      }
    };

    for (const acquired of pmac.pluginsAcquirers) {
      for (const vpr of acquired.validInactivePlugins) {
        const ac: ActivateContext<this> = {
          pluginsManager: this,
          vpr,
        };
        if (pmac.beforeActivate) await pmac.beforeActivate(ac);
        if (isActivatablePlugin(ac.vpr.plugin)) {
          activate(await ac.vpr.plugin.activate(ac));
        } else if (isActivatableSyncPlugin(ac.vpr.plugin)) {
          activate(ac.vpr.plugin.activateSync(ac));
        } else {
          // not a typescript module or no activation hook requested, no special activation
          this.plugins.push(ac.vpr.plugin);
        }
        if (isPluginGraphContributor(ac.vpr.plugin)) {
          ac.vpr.plugin.activateGraphNode(this.pluginsGraph);
        }
        if (pmac.afterActivate) await pmac.afterActivate(ac.vpr.plugin);
      }

      for (const ipr of acquired.invalidPlugins) {
        this.invalidPlugins.push(ipr);
      }
    }
  }

  async deactivate(ctx: PluginsManagerDeactivationContext): Promise<void> {
    for (const plugin of this.plugins) {
      const dac: DeactivateContext<this> = { pluginsManager: this, plugin };
      if (ctx.beforeDeactivate) await ctx.beforeDeactivate(dac);
      if (isActivatablePlugin(plugin)) {
        await plugin.deactivate(dac);
        // the ActivatablePlugin is immutable for others, but we're special
        ((plugin as unknown) as MutableActivationStateSupplier)
          .activationState = PluginActivationState.Inactive;
      } else if (isActivatableSyncPlugin(plugin)) {
        plugin.deactivateSync(dac);
        // the ActivatablePlugin is immutable for others, but we're special
        ((plugin as unknown) as MutableActivationStateSupplier)
          .activationState = PluginActivationState.Inactive;
      }
      if (
        isPluginGraphContributor(dac.plugin) && dac.plugin.deactivateGraphNode
      ) {
        dac.plugin.deactivateGraphNode(this.pluginsGraph);
      }
      if (ctx.afterDeactivate) await ctx.afterDeactivate(dac);
    }
  }

  findPlugin<P extends Plugin>(
    predicate: (plugin: Plugin, index: number, plugins: Plugin[]) => unknown,
    guard?: safety.TypeGuard<P>,
    onGuardFail?: (plugin: Plugin) => void,
  ): P | undefined {
    const plugin = this.plugins.find(predicate);
    if (plugin && guard) {
      if (guard(plugin)) return plugin;
      if (onGuardFail) onGuardFail(plugin);
    } else if (plugin) {
      return plugin as P;
    }
    return undefined;
  }
}
