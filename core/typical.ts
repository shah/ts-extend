import { cxg, safety } from "./deps.ts";
import * as fr from "./framework.ts";
import * as metrics from "./metrics.ts";

export function typicalInvalidPluginRegistration(
  source: fr.PluginSource,
  diagnostics: string | string[],
): fr.InvalidPluginRegistration {
  return {
    source: source,
    issues: [{
      source: source,
      diagnostics: typeof diagnostics === "string"
        ? [diagnostics]
        : diagnostics,
    }],
  };
}

/**
 * Construct a base Plugin instance. The caller is expected to properly
 * provide all plugin properties because what's returned will be coerced to
 * the given Plugin generic parameter.
 * @param applicability indicates whether the source should be redirected
 * @param defaultSource is the default source
 * @param defaultNature is the default nature
 * @param options are the registration options
 * @returns a type-coerced result of the new plugin instance
 */
export function typicalPotentialPlugin<
  Plugin extends fr.Plugin,
  PluginSource extends fr.PluginSource,
  PluginNature extends fr.PluginNature,
  PluginProps extends Record<string, unknown>,
>(
  defaultSource: PluginSource,
  defaultNature: PluginNature,
  options?: fr.PluginRegistrationOptions & {
    readonly applicability: Pick<
      fr.PluginRegistrarSourceApplicability,
      "redirectSource"
    >;
    readonly additionalPluginProperties?: PluginProps;
  },
): Plugin {
  const source = options?.applicability.redirectSource || defaultSource;
  const nature = options?.nature
    ? options.nature(defaultNature)
    : defaultNature;
  const potential: fr.Plugin = { source, nature };
  const defaultGraphNode = new cxg.Node<fr.Plugin>(source.graphNodeName);
  const graphNode = options?.graphNode
    ? options.graphNode(potential, defaultGraphNode)
    : defaultGraphNode;
  const plugin:
    & fr.Plugin
    & fr.PluginGraphNodeSupplier
    & fr.PluginGraphContributor = {
      ...potential,
      graphNode,
      activateGraphNode: (graph) => {
        graph.addNode(graphNode);
        return graphNode;
      },
      ...options?.additionalPluginProperties,
    };
  return plugin as unknown as Plugin;
}

export async function typicalPluginRegistration<
  PluginSource extends fr.PluginSource,
  PluginNature extends fr.PluginNature,
  PluginProps extends Record<string, unknown>,
>(
  applicability: fr.PluginRegistrarSourceApplicability,
  defaultSource: PluginSource,
  defaultNature: PluginNature,
  onInvalid: (
    src: fr.PluginSource,
    suggested?: fr.InvalidPluginRegistration,
  ) => Promise<fr.PluginRegistration>,
  options?: fr.PluginRegistrationOptions & {
    readonly applicabilityDiagnostic?: string;
    readonly additionalPluginProperties?: PluginProps;
  },
): Promise<fr.PluginRegistration | false> {
  if (applicability.isApplicable) {
    const potential = typicalPotentialPlugin(
      defaultSource,
      defaultNature,
      { ...options, applicability },
    );
    if (applicability.alternateRegistrar) {
      return await applicability.alternateRegistrar.pluginRegistration(
        potential.source,
        onInvalid,
        options,
      );
    }
    const registration: fr.ValidPluginRegistration = {
      source: potential.source,
      plugin: potential,
    };
    return options?.transform ? options.transform(registration) : registration;
  }
  if (options?.applicabilityDiagnostic) {
    const result: fr.InvalidPluginRegistration = {
      source: defaultSource,
      issues: [{
        source: defaultSource,
        diagnostics: [options.applicabilityDiagnostic],
      }],
    };
    return onInvalid(defaultSource, result);
  }
  return false;
}

export interface TypicalMetricOptions {
  readonly identity?: string;
  readonly markOptions?: PerformanceMarkOptions;
  readonly measureOptions?: PerformanceMeasureOptions;
}

export function typicalMetric(
  options?: TypicalMetricOptions,
): metrics.Instrumentable {
  const name = options?.identity || `metric${window.globalMetricsCount}`;
  const result: metrics.Instrumentable & {
    measured?: PerformanceMeasure;
  } = {
    marked: performance.mark(name, options?.markOptions),
    measure: (measureOptions?: PerformanceMeasureOptions) => {
      if (!result.measured) {
        result.measured = performance.measure(name, {
          ...(measureOptions || options?.measureOptions),
          start: result.marked.startTime,
        });
      }
      return result.measured;
    },
    baggage: () => {
      return { ...result.marked.detail, ...result.measured?.detail };
    },
  };
  return result; // it's the responsibility of the caller to later call result.measure().
}

export abstract class TypicalPluginsManager implements fr.PluginsManager {
  readonly plugins: fr.Plugin[] = [];
  readonly pluginsGraph: fr.PluginsGraph = new cxg.CxGraph();
  readonly invalidPlugins: fr.InvalidPluginRegistration[] = [];

  constructor() {
  }

  registerInvalidPlugin(ipr: fr.InvalidPluginRegistration) {
    this.invalidPlugins.push(ipr);
    return ipr;
  }

  async activatePlugin(
    pluginOrVPR: fr.Plugin | fr.ValidPluginRegistration,
    pmac?: fr.PluginsManagerActivationContext,
  ): Promise<fr.Plugin | false> {
    let plugin: fr.Plugin;
    let state = fr.PluginActivationState.Active;

    if (fr.isValidPluginRegistration(pluginOrVPR)) {
      const ac: fr.ActivateContext<this> = {
        pluginsManager: this,
        vpr: pluginOrVPR,
        pmac,
      };
      if (pmac?.beforeActivate) await pmac.beforeActivate(ac);
      let ar: fr.ActivateResult | undefined;
      if (fr.isActivatablePlugin(pluginOrVPR.plugin)) {
        ar = await pluginOrVPR.plugin.activate(ac);
      } else if (fr.isActivatableSyncPlugin(pluginOrVPR.plugin)) {
        ar = pluginOrVPR.plugin.activateSync(ac);
      }
      if (ar) {
        if (fr.isInvalidPluginRegistration(ar.registration)) {
          this.registerInvalidPlugin(ar.registration);
          return false;
        }
        plugin = ar.registration.plugin;
        state = ar.activationState;
      } else {
        plugin = pluginOrVPR.plugin;
      }
    } else {
      plugin = pluginOrVPR;
    }

    this.plugins.push(plugin);
    if (fr.isPluginGraphContributor(plugin)) {
      plugin.activateGraphNode(this.pluginsGraph);
    }

    // the ActivatablePlugin is immutable for others, but we're special
    ((plugin as unknown) as fr.MutableActivationStateSupplier).activationState =
      state;
    if (pmac?.afterActivate) await pmac.afterActivate(plugin);
    return plugin;
  }

  async deactivatePlugin(
    plugin: fr.Plugin,
    pmdc?: fr.PluginsManagerDeactivationContext,
  ): Promise<void> {
    const dac: fr.DeactivateContext<this> = { pluginsManager: this, plugin };
    if (pmdc?.beforeDeactivate) await pmdc.beforeDeactivate(dac);
    if (fr.isActivatablePlugin(plugin)) {
      await plugin.deactivate(dac);
    } else if (fr.isActivatableSyncPlugin(plugin)) {
      plugin.deactivateSync(dac);
    }
    if (
      fr.isPluginGraphContributor(dac.plugin) &&
      dac.plugin.deactivateGraphNode
    ) {
      dac.plugin.deactivateGraphNode(this.pluginsGraph);
    }
    // the ActivatablePlugin is immutable for others, but we're special
    ((plugin as unknown) as fr.MutableActivationStateSupplier)
      .activationState = fr.PluginActivationState.Inactive;
    if (pmdc?.afterDeactivate) await pmdc?.afterDeactivate(dac);
  }

  async activate(pmac: fr.PluginsManagerActivationContext): Promise<void> {
    for (const acquired of pmac.pluginsAcquirers) {
      for (const vpr of acquired.validInactivePlugins) {
        await this.activatePlugin(vpr, pmac);
      }
      for (const ipr of acquired.invalidPlugins) {
        this.invalidPlugins.push(ipr);
      }
    }
  }

  async deactivate(pmdc: fr.PluginsManagerDeactivationContext): Promise<void> {
    for (const plugin of this.plugins) {
      await this.deactivatePlugin(plugin, pmdc);
    }
  }

  findPlugin<P extends fr.Plugin>(
    predicate: (
      plugin: fr.Plugin,
      index: number,
      plugins: fr.Plugin[],
    ) => unknown,
    guard?: safety.TypeGuard<P>,
    onGuardFail?: (plugin: fr.Plugin) => void,
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

  findPlugins(
    predicate: (
      plugin: fr.Plugin,
      index: number,
      plugins: fr.Plugin[],
    ) => unknown,
  ): fr.Plugin[] | undefined {
    const found = this.plugins.filter(predicate);
    if (found.length == 0) return undefined;
    return found;
  }
}
