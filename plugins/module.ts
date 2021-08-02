import {
  colors,
  cxg,
  govnSvcTelemetry as telem,
  safety,
} from "../core/deps.ts";
import * as extn from "../core/mod.ts";

declare global {
  interface Window {
    readonly cachedModulesSingleton: extn.SingletonSync<
      Map<URL, ModuleCacheEntry>
    >;
    readonly cachedModules: Map<URL, ModuleCacheEntry>;
  }
}

export interface DenoModulePluginSource extends extn.PluginSource {
  readonly moduleEntryPoint: unknown;
}

export const isDenoModulePluginSource = safety.typeGuard<
  DenoModulePluginSource
>(
  "registrarID",
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
  "moduleEntryPoint",
);

export interface DenoModulePluginNature<PM extends extn.PluginsManager>
  extends extn.PluginNature {
  readonly moduleMetaData: DenoModuleMetaData<PM>;
}

export const isDenoModulePluginNature = safety.typeGuard<
  DenoModulePluginNature<extn.PluginsManager>
>(
  "identity",
  "moduleMetaData",
);

export interface ModuleCacheEntry {
  readonly source: URL;
  readonly module: unknown;
}

// cast to override the readonly attribute (it's OK for us to write the value)
(window.cachedModulesSingleton as extn.SingletonSync<
  Map<URL, ModuleCacheEntry>
>) = extn.SingletonsManager.globalInstance()
  .singletonSync(
    () => {
      return new Map<URL, ModuleCacheEntry>();
    },
  );

// cast to override the readonly attribute (it's OK for us to write the value)
(window.cachedModules as Map<URL, ModuleCacheEntry>) = window
  .cachedModulesSingleton.value();

export interface DenoModulePlugin extends extn.Plugin {
  readonly module: unknown;
}

export const isDenoModulePlugin = safety.typeGuard<DenoModulePlugin>(
  "nature",
  "source",
  "module",
);

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivateContext<PM extends extn.PluginsManager>
  extends extn.ActivateContext<PM> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleDeactivateContext<PM extends extn.PluginsManager>
  extends extn.DeactivateContext<PM> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivateResult extends extn.ActivateResult {
}

export interface DenoModuleActivatable<PM extends extn.PluginsManager>
  extends
    extn.Activatable<
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

export interface DenoModuleActivatableSync<PM extends extn.PluginsManager>
  extends
    extn.ActivatableSync<
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

export function isDenoModuleActivatablePlugin<PM extends extn.PluginsManager>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatable<PM> {
  if (isDenoModulePlugin(o)) {
    return "activate" in o && "deactivate" in o && "activationState" in o;
  }
  return false;
}

export function isDenoModuleActivatableSyncPlugin<
  PM extends extn.PluginsManager,
>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatableSync<PM> {
  if (isDenoModulePlugin(o)) {
    return "activateSync" in o && "deactivateSync" in o &&
      "activationState" in o;
  }
  return false;
}

export interface DenoModuleDynamicPluginSupplier<
  PM extends extn.PluginsManager,
> {
  (
    moduleEntryPoint: unknown,
    nature: DenoModulePluginNature<PM>,
    registrar: DenoModuleRegistrar<PM>,
    options?: extn.PluginRegistrationOptions,
  ): Promise<extn.PluginRegistration>;
}

export interface DenoModuleScalarValueGuard<T> {
  readonly guard: (o: unknown) => o is T;
  readonly guardFailureDiagnostic: (o: unknown) => string;
}

export const isDenoModuleScalarValueGuard = safety.typeGuard<
  DenoModuleScalarValueGuard<unknown>
>("guard", "guardFailureDiagnostic");

/**
 * DenoModuleMetaData represents Plugin information defined as constants in
 * a Deno module. Plugin details defined in this interface may be overridden
 * by a Deno module plugin.
 */
export interface DenoModuleMetaData<PM extends extn.PluginsManager> {
  nature: extn.MutableOptionalPluginNature;
  source: extn.MutableOptionalPluginSource;
  graphNode?: (
    metaData: DenoModuleMetaData<PM>,
  ) => extn.PluginGraphNode;
  activate?: (
    ac: DenoModuleActivateContext<PM>,
  ) => Promise<DenoModuleActivateResult>;
  activateSync?: (
    ac: DenoModuleActivateContext<PM>,
  ) => DenoModuleActivateResult;
  plugin?: DenoModuleDynamicPluginSupplier<PM>;
  scalarGuard?: DenoModuleScalarValueGuard<unknown>;
  untyped: Record<string, unknown>;
}

export interface TypeScriptModuleRegistrationSupplier<
  PM extends extn.PluginsManager,
> {
  (
    manager: PM,
    potential: DenoModulePlugin,
    metaData: DenoModuleMetaData<PM>,
    options?: extn.PluginRegistrationOptions,
  ): Promise<extn.ValidPluginRegistration | extn.InvalidPluginRegistration>;
}

export interface DenoFunctionModulePlugin extends DenoModulePlugin {
  readonly handler: DenoFunctionModuleHandler;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
}

export function isGeneratorFunction(o: unknown) {
  if (typeof o !== "function") {
    return false;
  }

  const name = o.constructor.name;
  return (name === "GeneratorFunction" || name === "AsyncGeneratorFunction");
}

export function isDenoFunctionModulePlugin(
  o: unknown,
): o is DenoFunctionModulePlugin {
  if (isDenoModulePlugin(o)) {
    return "handler" in o && "isAsync" in o && "isGenerator" in o;
  }
  return false;
}

export type DenoFunctionModuleHandlerResult = unknown;

export interface DenoFunctionModuleHandler {
  (ps: extn.PluginSupplier):
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

export interface DenoScalarModulePlugin<T> extends DenoModulePlugin {
  readonly scalar: T;
}

export function isDenoScalarModulePlugin<T>(
  o: unknown,
): o is DenoScalarModulePlugin<T> {
  if (isDenoModulePlugin(o)) {
    return "scalar" in o;
  }
  return false;
}

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

export class StaticPlugins<PM extends extn.PluginsManager>
  implements extn.InactivePluginsSupplier {
  readonly validInactivePlugins: extn.ValidPluginRegistration[] = [];
  readonly invalidPlugins: extn.InvalidPluginRegistration[] = [];
  readonly unknownPlugins: extn.PluginRegistration[] = [];

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
    if (extn.isValidPluginRegistration(registration)) {
      this.validInactivePlugins.push(registration);
    } else if (extn.isInvalidPluginRegistration(registration)) {
      this.invalidPlugins.push(registration);
    } else {
      this.unknownPlugins.push(registration);
    }
  }
}

export class DenoModuleRegistrar<PM extends extn.PluginsManager>
  implements extn.PluginRegistrar {
  readonly registrarID = "DenoModuleRegistrar";
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
          case "registrarID":
            // if module has `export const registrarID = "X"` then use that as the registrarID
            result.source.registrarID = value;
            break;

          case "systemID":
            // if module has `export const systemID = "X"` then use that as the systemID
            result.source.systemID = value;
            break;

          case "friendlyName":
            // if module has `export const friendlyName = "X"` then use that as the friendlyName
            result.source.friendlyName = value;
            break;

          case "abbreviatedName":
            // if module has `export const abbreviatedName = "X"` then use that as the abbreviatedName
            result.source.abbreviatedName = value;
            break;

          case "graphNodeName":
            // if module has `export const graphNodeName = "X"` then use that as the graphNodeName
            result.source.graphNodeName = value;
            break;
        }

        continue;
      }

      if (key === "nature" && isDenoModulePluginNature(value)) {
        result.nature = value;
      }
      if (key === "scalarGuard" && isDenoModuleScalarValueGuard(value)) {
        result.scalarGuard = value as DenoModuleScalarValueGuard<unknown>;
      }

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
            ) => extn.PluginGraphNode);
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

  moduleNature(
    metaData: DenoModuleMetaData<PM>,
    identity?: extn.PluginNatureIdentity,
  ): DenoModulePluginNature<PM> {
    return {
      identity: identity || "deno-module",
      ...metaData.nature,
      moduleMetaData: metaData,
    };
  }

  // deno-lint-ignore require-await
  async validate(
    potential: DenoModulePlugin,
    options?: extn.PluginRegistrationOptions,
  ): Promise<extn.ValidPluginRegistration | extn.InvalidPluginRegistration> {
    // deno-lint-ignore no-explicit-any
    const module = potential.module as any;
    const moduleDefault = module.default;
    let guardFailedDiagnostic: string | undefined;

    // if we've already created a valid plugin (e.g. from cache)
    if (extn.isValidPluginRegistration(moduleDefault)) {
      return moduleDefault;
    }

    // if an entire plugin is pre-constructed
    if (isDenoModulePlugin(moduleDefault)) {
      const result: extn.ValidPluginRegistration = {
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
      const plugin: DenoFunctionModulePlugin = {
        ...potential,
        handler,
        isAsync,
        isGenerator,
      };
      if (!options?.guard || options.guard.guard(plugin)) {
        const result: extn.ValidPluginRegistration = {
          source: potential.source,
          plugin,
        };
        return result;
      }
      // if we get to here it means we have a guard and it failed
      guardFailedDiagnostic = options.guard.guardFailureDiagnostic(plugin);
    } else {
      // deno-lint-ignore no-explicit-any
      const plugin: DenoScalarModulePlugin<any> = {
        ...potential,
        scalar: moduleDefault,
      };
      if (!options?.guard || options.guard.guard(plugin)) {
        const result: extn.ValidPluginRegistration = {
          source: potential.source,
          plugin,
        };
        return result;
      }
      // if we get to here it means we have a guard and it failed
      guardFailedDiagnostic = options.guard.guardFailureDiagnostic(plugin);
    }

    const result: extn.InvalidPluginRegistration = {
      source: potential.source,
      issues: [{
        source: potential.source,
        diagnostics: [`guard failure: ${colors.yellow(guardFailedDiagnostic)}`],
      }],
    };
    return result;
  }

  // deno-lint-ignore require-await
  async pluginApplicability(
    source: extn.PluginSource,
  ): Promise<extn.PluginRegistrarSourceApplicability> {
    if (isDenoModulePluginSource(source)) {
      return { isApplicable: true };
    }
    return { isApplicable: false };
  }

  async pluginRegistration(
    ps: extn.PluginSource,
    onInvalid: (
      src: extn.PluginSource,
      suggested?: extn.InvalidPluginRegistration,
    ) => Promise<extn.PluginRegistration>,
    options?: extn.PluginRegistrationOptions,
  ): Promise<extn.PluginRegistration> {
    const applicable = await this.pluginApplicability(ps);
    const dms = applicable.redirectSource || ps;
    if (isDenoModulePluginSource(dms)) {
      try {
        if (dms.moduleEntryPoint) {
          const metaData = this.moduleMetaData(dms.moduleEntryPoint);
          const defaultNature: DenoModulePluginNature<PM> = this.moduleNature(
            metaData,
          );
          let registration: extn.PluginRegistration;
          if (metaData.plugin) {
            // a deno module can provide an exported async module method called
            // plugin() which returns a registration record dynamically
            registration = await metaData.plugin(
              dms.moduleEntryPoint,
              defaultNature,
              this,
              options,
            );
          } else {
            const source: DenoModulePluginSource = {
              ...dms,
              ...metaData.source,
            };
            const nature = options?.nature
              ? options.nature(defaultNature)
              : defaultNature;
            const defaultGraphNode = metaData.graphNode
              ? metaData.graphNode(metaData)
              : new cxg.Node<extn.Plugin>(source.graphNodeName);
            const graphNode = options?.graphNode
              ? options?.graphNode({ nature, source }, defaultGraphNode)
              : defaultGraphNode;
            const potential:
              & DenoModulePlugin
              & extn.PluginGraphNodeSupplier
              & extn.PluginGraphContributor = {
                module: dms.moduleEntryPoint,
                source,
                graphNode,
                nature,
                activateGraphNode: (graph) => {
                  graph.addNode(graphNode);
                  return graphNode;
                },
              };
            registration = await this.validate(potential);
          }
          if (
            options?.transform && extn.isValidPluginRegistration(registration)
          ) {
            return options.transform(registration);
          }
          return registration;
        } else {
          const result: extn.InvalidPluginRegistration = {
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
        const result: extn.InvalidPluginRegistration = {
          source: ps,
          issues: [{
            source: dms,
            diagnostics: [`DenoModuleRegistrar exception: ${err}`],
          }],
        };
        return result;
      }
    }
    const result: extn.InvalidPluginRegistration = {
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
