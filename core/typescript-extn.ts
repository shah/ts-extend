import { colors, cxg, govnSvcTelemetry as telem, safety } from "./deps.ts";
import * as fr from "./framework.ts";
import { SingletonsManager, SingletonSync } from "./singleton.ts";

declare global {
  interface Window {
    readonly cachedModulesSingleton: SingletonSync<Map<URL, ModuleCacheEntry>>;
    readonly cachedModules: Map<URL, ModuleCacheEntry>;
  }
}

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

/**
 * DenoModuleMetaData represents Plugin information defined as constants in
 * a Deno module. Plugin details defined in this interface may be overridden
 * by a Deno module plugin.
 */
export interface DenoModuleMetaData<PM extends fr.PluginsManager> {
  nature: fr.MutableOptionalPluginNature;
  source: fr.MutableOptionalPluginSource;
  constructGraphNode?: (
    metaData: DenoModuleMetaData<PM>,
  ) => fr.PluginGraphNode;
  activate?: (
    ac: DenoModuleActivateContext<PM>,
  ) => Promise<DenoModuleActivateResult>;
  activateSync?: (
    ac: DenoModuleActivateContext<PM>,
  ) => DenoModuleActivateResult;
  untyped: Record<string, unknown>;
}

export interface TypeScriptModuleRegistrationSupplier<
  PM extends fr.PluginsManager,
> {
  (
    manager: PM,
    potential: DenoModulePlugin,
    metaData: DenoModuleMetaData<PM>,
  ): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration>;
}

export interface TypeScriptRegistrarTelemetry extends telem.Instrumentation {
  readonly import: (source: URL) => telem.Instrumentable;
}

export interface TypeScriptRegistrarOptions<PM extends fr.PluginsManager> {
  readonly validateModule: TypeScriptModuleRegistrationSupplier<PM>;
  readonly importModule: (src: URL) => Promise<unknown>;
  readonly moduleMetaData: (module: unknown) => DenoModuleMetaData<PM>;
  readonly activate: (
    dmac: DenoModuleActivateContext<PM>,
  ) => Promise<DenoModuleActivateResult>;
  readonly telemetry: TypeScriptRegistrarTelemetry;
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

export async function importUncachedModule(
  src: URL,
  telemetry: TypeScriptRegistrarTelemetry,
): Promise<unknown> {
  const instr = telemetry.import(src);
  const module = await import(src.toString());
  instr.measure();
  return module;
}

export async function importCachedModule(
  source: URL,
  telemetry: TypeScriptRegistrarTelemetry,
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
export async function registerDenoFunctionModule<PM extends fr.PluginsManager>(
  _manager: PM,
  potential: DenoModulePlugin,
  metaData: DenoModuleMetaData<PM>,
): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration> {
  // deno-lint-ignore no-explicit-any
  const module = potential.module as any;
  const moduleDefault = module.default;

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
    const result: fr.ValidPluginRegistration = {
      source: potential.source,
      plugin,
    };
    return result;
  }

  const result: fr.InvalidPluginRegistration = {
    source: potential.source,
    issues: [{
      source: potential.source,
      diagnostics: [
        `invalid plugin: typeof 'default' is ${
          colors.yellow(typeof moduleDefault)
        } (expected function, DenoFunctionModulePlugin, or ValidPluginRegistration instance)`,
      ],
    }],
  };
  return result;
}

export class TypicalTypeScriptRegistrarTelemetry extends telem.Telemetry
  implements TypeScriptRegistrarTelemetry {
  import(source: URL): telem.Instrumentable {
    return this.prepareInstrument({
      identity: "TypeScriptRegistrar.import",
      baggage: { source },
    });
  }
}

export function moduleMetaData<PM extends fr.PluginsManager>(
  module: unknown,
): DenoModuleMetaData<PM> {
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
        case "constructGraphNode":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.constructGraphNode = value as ((
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
export async function typicalDenoModuleActivate<PM extends fr.PluginsManager>(
  ac: DenoModuleActivateContext<PM>,
): Promise<
  DenoModuleActivateContext<PM> & DenoModuleActivateResult
> {
  ac.pluginsManager.pluginsGraph.addNode(
    new cxg.Node(ac.vpr.plugin.source.graphNodeName),
  );
  return {
    ...ac,
    registration: ac.vpr,
    activationState: fr.PluginActivationState.Active,
  };
}

export class StaticPlugins<PM extends fr.PluginsManager>
  implements fr.InactivePluginsSupplier {
  readonly validInactivePlugins: fr.ValidPluginRegistration[] = [];
  readonly invalidPlugins: fr.InvalidPluginRegistration[] = [];

  constructor(
    readonly manager: PM,
    readonly tsro: TypeScriptRegistrarOptions<PM>,
  ) {
  }

  async acquire(source: DenoModulePlugin, module: unknown): Promise<void> {
    const staticModule = await registerDenoFunctionModule(
      this.manager,
      { ...source, module: module },
      this.tsro.moduleMetaData(module),
    );
    if (fr.isValidPluginRegistration(staticModule)) {
      this.validInactivePlugins.push(staticModule);
    } else {
      this.invalidPlugins.push(staticModule);
    }
  }
}
