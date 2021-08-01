import { colors, cxg, govnSvcTelemetry as telem, safety } from "./deps.ts";
import * as fr from "./framework.ts";
import { SingletonsManager, SingletonSync } from "./singleton.ts";

declare global {
  interface Window {
    readonly cachedModulesSingleton: SingletonSync<Map<URL, ModuleCacheEntry>>;
    readonly cachedModules: Map<URL, ModuleCacheEntry>;
  }
}

export interface DenoModulePluginSource extends fr.PluginSource {
  readonly moduleEntryPoint: unknown;
}

export const isDenoModulePluginSource = safety.typeGuard<
  DenoModulePluginSource
>(
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
  "moduleEntryPoint",
);

export interface ModuleCacheEntry {
  readonly source: URL;
  readonly module: unknown;
}

// cast to override the readonly attribute (it's OK for us to write the value)
(window.cachedModulesSingleton as SingletonSync<Map<URL, ModuleCacheEntry>>) =
  SingletonsManager.globalInstance()
    .singletonSync(
      () => {
        return new Map<URL, ModuleCacheEntry>();
      },
    );

// cast to override the readonly attribute (it's OK for us to write the value)
(window.cachedModules as Map<URL, ModuleCacheEntry>) = window
  .cachedModulesSingleton.value();

export interface DenoModulePlugin extends fr.Plugin {
  readonly module: unknown;
}

export const isDenoModulePlugin = safety.typeGuard<DenoModulePlugin>(
  "nature",
  "source",
  "module",
);

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivateContext<PM extends fr.PluginsManager>
  extends fr.ActivateContext<PM> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleDeactivateContext<PM extends fr.PluginsManager>
  extends fr.DeactivateContext<PM> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivateResult extends fr.ActivateResult {
}

export interface DenoModuleActivatable<PM extends fr.PluginsManager>
  extends
    fr.Activatable<
      PM,
      DenoModuleActivateContext<PM>,
      DenoModuleDeactivateContext<PM>
    > {
  readonly activate: (
    ac: DenoModuleActivateContext<PM>,
  ) => Promise<DenoModuleActivateResult>;
  readonly deactivate: (
    ac: DenoModuleDeactivateContext<PM>,
  ) => Promise<void>;
}

export interface DenoModuleActivatableSync<PM extends fr.PluginsManager>
  extends
    fr.ActivatableSync<
      PM,
      DenoModuleActivateContext<PM>,
      DenoModuleDeactivateContext<PM>
    > {
  readonly activateSync: (
    ac: DenoModuleActivateContext<PM>,
  ) => DenoModuleActivateResult;
  readonly deactivateSync: (
    ac: DenoModuleDeactivateContext<PM>,
  ) => Promise<void>;
}

export function isDenoModuleActivatablePlugin<PM extends fr.PluginsManager>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatable<PM> {
  if (isDenoModulePlugin(o)) {
    return "activate" in o && "deactivate" in o && "activationState" in o;
  }
  return false;
}

export function isDenoModuleActivatableSyncPlugin<PM extends fr.PluginsManager>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatableSync<PM> {
  if (isDenoModulePlugin(o)) {
    return "activateSync" in o && "deactivateSync" in o &&
      "activationState" in o;
  }
  return false;
}

export interface DenoModuleDynamicPluginSupplier<PM extends fr.PluginsManager> {
  (
    moduleEntryPoint: unknown,
    registrar: DenoModuleRegistrar<PM>,
    metaData: DenoModuleMetaData<PM>,
    options?: fr.PluginRegistrationOptions,
  ): Promise<fr.PluginRegistration>;
}

/**
 * DenoModuleMetaData represents Plugin information defined as constants in
 * a Deno module. Plugin details defined in this interface may be overridden
 * by a Deno module plugin.
 */
export interface DenoModuleMetaData<PM extends fr.PluginsManager> {
  nature: fr.MutableOptionalPluginNature;
  source: fr.MutableOptionalPluginSource;
  graphNode?: (
    metaData: DenoModuleMetaData<PM>,
  ) => fr.PluginGraphNode;
  activate?: (
    ac: DenoModuleActivateContext<PM>,
  ) => Promise<DenoModuleActivateResult>;
  activateSync?: (
    ac: DenoModuleActivateContext<PM>,
  ) => DenoModuleActivateResult;
  plugin?: DenoModuleDynamicPluginSupplier<PM>;
  untyped: Record<string, unknown>;
}

export interface TypeScriptModuleRegistrationSupplier<
  PM extends fr.PluginsManager,
> {
  (
    manager: PM,
    potential: DenoModulePlugin,
    metaData: DenoModuleMetaData<PM>,
    options?: fr.PluginRegistrationOptions,
  ): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration>;
}

export interface DenoFunctionModulePlugin<PM extends fr.PluginsManager>
  extends DenoModulePlugin {
  readonly handler: DenoFunctionModuleHandler;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly metaData: DenoModuleMetaData<PM>;
}

export function isGeneratorFunction(o: unknown) {
  if (typeof o !== "function") {
    return false;
  }

  const name = o.constructor.name;
  return (name === "GeneratorFunction" || name === "AsyncGeneratorFunction");
}

export function isDenoFunctionModulePlugin<PM extends fr.PluginsManager>(
  o: unknown,
): o is DenoFunctionModulePlugin<PM> {
  if (isDenoModulePlugin(o)) {
    return "handler" in o && "isAsync" in o && "isGenerator" in o;
  }
  return false;
}

export type DenoFunctionModuleHandlerResult = unknown;

export interface DenoFunctionModuleHandler {
  (ps: fr.PluginSupplier):
    | Promise<DenoFunctionModuleHandlerResult>
    | DenoFunctionModuleHandlerResult
    | Promise<
      Generator<
        DenoFunctionModuleHandlerResult,
        DenoFunctionModuleHandlerResult
      >
    >
    | Generator<
      DenoFunctionModuleHandlerResult,
      DenoFunctionModuleHandlerResult
    >;
}

export interface DenoFunctionModuleActionResult {
  readonly dfmhResult: DenoFunctionModuleHandlerResult;
}

export const isDenoFunctionModuleActionResult = safety.typeGuard<
  DenoFunctionModuleActionResult
>("dfmhResult");

export interface ImportModuleTelemetrySupplier {
  readonly import: (source: URL) => telem.Instrumentable;
}

export async function importUncachedModule(
  src: URL,
  telemetry: ImportModuleTelemetrySupplier,
): Promise<unknown> {
  const instr = telemetry.import(src);
  const module = await import(src.toString());
  instr.measure();
  return module;
}

export async function importCachedModule(
  source: URL,
  telemetry: ImportModuleTelemetrySupplier,
): Promise<unknown> {
  let mce = window.cachedModules.get(source);
  if (!mce) {
    mce = {
      source,
      module: await importUncachedModule(source, telemetry),
    };
    window.cachedModules.set(source, mce);
  }
  return mce.module;
}

// deno-lint-ignore require-await
export async function validateDenoFunctionModule<PM extends fr.PluginsManager>(
  _manager: PM,
  potential: DenoModulePlugin,
  metaData: DenoModuleMetaData<PM>,
  options?: fr.PluginRegistrationOptions,
): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration> {
  // deno-lint-ignore no-explicit-any
  const module = potential.module as any;
  const moduleDefault = module.default;
  let guardFailedDiagnostic: string | undefined;

  // if we've already created a valid plugin (e.g. from cache)
  if (fr.isValidPluginRegistration(moduleDefault)) {
    return moduleDefault;
  }

  // if an entire plugin is pre-constructed
  if (isDenoModulePlugin(moduleDefault)) {
    const result: fr.ValidPluginRegistration = {
      plugin: moduleDefault,
      source: moduleDefault.source,
    };
    return result;
  }

  // not cached or pre-constructed, see if it's a function
  if (typeof moduleDefault === "function") {
    const handler = moduleDefault as DenoFunctionModuleHandler;
    const handlerConstrName = handler.constructor.name;
    const isGenerator = (handlerConstrName === "GeneratorFunction" ||
      handlerConstrName === "AsyncGeneratorFunction");
    const isAsync = handlerConstrName === "AsyncFunction" ||
      handlerConstrName === "AsyncGeneratorFunction";
    const plugin: DenoFunctionModulePlugin<PM> = {
      ...potential,
      handler,
      isAsync,
      isGenerator,
      metaData,
    };
    if (!options?.guard || options.guard.guard(plugin)) {
      const result: fr.ValidPluginRegistration = {
        source: potential.source,
        plugin,
      };
      return result;
    }
    // if we get to here it means we have a guard and it failed
    guardFailedDiagnostic = options.guard.guardFailureDiagnostic(plugin);
  }

  const result: fr.InvalidPluginRegistration = {
    source: potential.source,
    issues: [{
      source: potential.source,
      diagnostics: [
        guardFailedDiagnostic
          ? `guard failure: ${colors.yellow(guardFailedDiagnostic)}`
          : `typeof 'default' is ${
            colors.yellow(typeof moduleDefault)
          } (expected function, DenoFunctionModulePlugin, or ValidPluginRegistration instance)`,
      ],
    }],
  };
  return result;
}

export class TypicalDenoModuleRegistrarTelemetry
  implements ImportModuleTelemetrySupplier {
  readonly instruments: telem.Instrument[];
  readonly prepareInstrument: (
    options?: telem.InstrumentationOptions,
  ) => telem.Instrumentable;

  constructor(readonly parent: telem.Instrumentation) {
    this.instruments = parent.instruments;
    this.prepareInstrument = parent.prepareInstrument;
  }

  import(source: URL): telem.Instrumentable {
    return this.prepareInstrument({
      identity: "TypeScriptRegistrar.import",
      baggage: { source },
    });
  }
}

export class StaticPlugins<PM extends fr.PluginsManager>
  implements fr.InactivePluginsSupplier {
  readonly validInactivePlugins: fr.ValidPluginRegistration[] = [];
  readonly invalidPlugins: fr.InvalidPluginRegistration[] = [];
  readonly unknownPlugins: fr.PluginRegistration[] = [];

  constructor(readonly registrar: DenoModuleRegistrar<PM>) {
  }

  async acquire(source: DenoModulePluginSource): Promise<void> {
    const registration = await this.registrar.pluginRegistration(
      source, // deno-lint-ignore require-await
      async (source, suggested) => {
        return suggested || {
          source,
          issues: [{
            source,
            diagnostics: [
              `invalid plugin: ${JSON.stringify(source)}`,
            ],
          }],
        };
      },
    );
    if (fr.isValidPluginRegistration(registration)) {
      this.validInactivePlugins.push(registration);
    } else if (fr.isInvalidPluginRegistration(registration)) {
      this.invalidPlugins.push(registration);
    } else {
      this.unknownPlugins.push(registration);
    }
  }
}

export class DenoModuleRegistrar<PM extends fr.PluginsManager>
  implements fr.PluginRegistrar {
  constructor(
    readonly manager: PM,
    readonly telemetry: ImportModuleTelemetrySupplier,
  ) {
  }

  moduleMetaData(module: unknown): DenoModuleMetaData<PM> {
    const result: DenoModuleMetaData<PM> = {
      nature: {},
      source: {},
      untyped: {},
    };
    for (const entry of Object.entries(module as Record<string, unknown>)) {
      const [key, value] = entry;
      result.untyped[key] = value;
      if (typeof value === "string") {
        switch (key) {
          case "systemID":
            // if module has `export const systemID = "X"` then use that as the graphName
            result.source.systemID = value;
            break;

          case "friendlyName":
            // if module has `export const friendlyName = "X"` then use that as the graphName
            result.source.friendlyName = value;
            break;

          case "abbreviatedName":
            // if module has `export const abbreviatedName = "X"` then use that as the graphName
            result.source.abbreviatedName = value;
            break;

          case "graphNodeName":
            // if module has `export const graphNodeName = "X"` then use that as the graphName
            result.source.graphNodeName = value;
            break;
        }

        continue;
      }

      if (key === "nature" && fr.isPluginNature(value)) result.nature = value;

      if (typeof value === "function") {
        switch (key) {
          case "plugin":
            // TODO: enhance type checking because a function could be defined incorrectly at runtime
            result.plugin = value as DenoModuleDynamicPluginSupplier<PM>;
            break;

          case "graphNode":
            // TODO: enhance type checking because a function could be defined incorrectly at runtime
            result.graphNode = value as ((
              metaData: DenoModuleMetaData<PM>,
            ) => fr.PluginGraphNode);
            break;

          case "activate":
            // TODO: enhance type checking because a function could be defined incorrectly at runtime
            result.activate = value as ((
              ac: DenoModuleActivateContext<PM>,
            ) => Promise<DenoModuleActivateResult>);
            break;

          case "activateSync":
            // TODO: enhance type checking because a function could be defined incorrectly at runtime
            result.activateSync = value as ((
              ac: DenoModuleActivateContext<PM>,
            ) => DenoModuleActivateResult);
            break;
        }
      }
    }

    return result;
  }

  // deno-lint-ignore require-await
  async validate(
    potential: DenoModulePlugin,
    metaData: DenoModuleMetaData<PM>,
    options?: fr.PluginRegistrationOptions,
  ): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration> {
    // deno-lint-ignore no-explicit-any
    const module = potential.module as any;
    const moduleDefault = module.default;
    let guardFailedDiagnostic: string | undefined;

    // if we've already created a valid plugin (e.g. from cache)
    if (fr.isValidPluginRegistration(moduleDefault)) {
      return moduleDefault;
    }

    // if an entire plugin is pre-constructed
    if (isDenoModulePlugin(moduleDefault)) {
      const result: fr.ValidPluginRegistration = {
        plugin: moduleDefault,
        source: moduleDefault.source,
      };
      return result;
    }

    // not cached or pre-constructed, see if it's a function
    if (typeof moduleDefault === "function") {
      const handler = moduleDefault as DenoFunctionModuleHandler;
      const handlerConstrName = handler.constructor.name;
      const isGenerator = (handlerConstrName === "GeneratorFunction" ||
        handlerConstrName === "AsyncGeneratorFunction");
      const isAsync = handlerConstrName === "AsyncFunction" ||
        handlerConstrName === "AsyncGeneratorFunction";
      const plugin: DenoFunctionModulePlugin<PM> = {
        ...potential,
        handler,
        isAsync,
        isGenerator,
        metaData,
      };
      if (!options?.guard || options.guard.guard(plugin)) {
        const result: fr.ValidPluginRegistration = {
          source: potential.source,
          plugin,
        };
        return result;
      }
      // if we get to here it means we have a guard and it failed
      guardFailedDiagnostic = options.guard.guardFailureDiagnostic(plugin);
    }

    const result: fr.InvalidPluginRegistration = {
      source: potential.source,
      issues: [{
        source: potential.source,
        diagnostics: [
          guardFailedDiagnostic
            ? `guard failure: ${colors.yellow(guardFailedDiagnostic)}`
            : `typeof 'default' is ${
              colors.yellow(typeof moduleDefault)
            } (expected function, DenoFunctionModulePlugin, or ValidPluginRegistration instance)`,
        ],
      }],
    };
    return result;
  }

  // deno-lint-ignore require-await
  async pluginApplicability(
    source: fr.PluginSource,
  ): Promise<fr.PluginRegistrarSourceApplicability> {
    if (isDenoModulePluginSource(source)) {
      return { isApplicable: true };
    }
    return { isApplicable: false };
  }

  async pluginRegistration(
    ps: fr.PluginSource,
    onInvalid: (
      src: fr.PluginSource,
      suggested?: fr.InvalidPluginRegistration,
    ) => Promise<fr.PluginRegistration>,
    options?: fr.PluginRegistrationOptions,
  ): Promise<fr.PluginRegistration> {
    const applicable = await this.pluginApplicability(ps);
    const dms = applicable.redirectSource || ps;
    if (isDenoModulePluginSource(dms)) {
      try {
        if (dms.moduleEntryPoint) {
          const metaData = this.moduleMetaData(dms.moduleEntryPoint);
          let registration: fr.PluginRegistration;
          if (metaData.plugin) {
            // a deno module can provide an exported async module method called
            // plugin() which returns a registration record dynamically
            registration = await metaData.plugin(
              dms.moduleEntryPoint,
              this,
              metaData,
              options,
            );
          } else {
            const source: DenoModulePluginSource = {
              ...dms,
              ...metaData.source,
            };
            const defaultNature = {
              identity: "deno-module",
              ...metaData.nature,
            };
            const nature = options?.nature
              ? options.nature(defaultNature)
              : defaultNature;
            const defaultGraphNode = metaData.graphNode
              ? metaData.graphNode(metaData)
              : new cxg.Node<fr.Plugin>(source.graphNodeName);
            const graphNode = options?.graphNode
              ? options?.graphNode({ nature, source }, defaultGraphNode)
              : defaultGraphNode;
            const potential:
              & DenoModulePlugin
              & fr.PluginGraphNodeSupplier
              & fr.PluginGraphContributor = {
                module: dms.moduleEntryPoint,
                source,
                graphNode,
                nature,
                activateGraphNode: (graph) => {
                  graph.addNode(graphNode);
                  return graphNode;
                },
              };
            registration = await this.validate(potential, metaData);
          }
          if (
            options?.transform && fr.isValidPluginRegistration(registration)
          ) {
            return options.transform(registration);
          }
          return registration;
        } else {
          const result: fr.InvalidPluginRegistration = {
            source: ps,
            issues: [{
              source: dms,
              diagnostics: [
                "DenoModuleRegistrar error: dms.moduleEntryPoint not provided",
              ],
            }],
          };
          return result;
        }
      } catch (err) {
        const result: fr.InvalidPluginRegistration = {
          source: ps,
          issues: [{
            source: dms,
            diagnostics: [`DenoModuleRegistrar exception: ${err}`],
          }],
        };
        return result;
      }
    }
    const result: fr.InvalidPluginRegistration = {
      source: ps,
      issues: [{
        source: dms,
        diagnostics: [
          "DenoModuleRegistrar only knows how to register DenoModulePluginSource instances",
        ],
      }],
    };
    return onInvalid(dms, result);
  }
}
