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
export interface DenoModuleActivateContext<PE extends fr.PluginExecutive>
  extends fr.ActivateContext<PE, fr.PluginContext<PE>, fr.PluginsSupplier<PE>> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivateResult extends fr.ActivateResult {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivatable<PE extends fr.PluginExecutive>
  extends fr.Activatable<PE> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivatableSync<PE extends fr.PluginExecutive>
  extends fr.ActivatableSync<PE> {
}

export function isDenoModuleActivatablePlugin<PE extends fr.PluginExecutive>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatable<PE> {
  if (isDenoModulePlugin(o)) {
    return "activate" in o;
  }
  return false;
}

export function isDenoModuleActivatableSyncPlugin<
  PE extends fr.PluginExecutive,
>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatableSync<PE> {
  if (isDenoModulePlugin(o)) {
    return "activateSync" in o;
  }
  return false;
}

/**
 * DenoModuleMetaData represents Plugin information defined as constants in
 * a Deno module. Plugin details defined in this interface may be overridden
 * by a Deno module plugin.
 */
export interface DenoModuleMetaData<PE extends fr.PluginExecutive> {
  nature: fr.MutableOptionalPluginNature;
  source: fr.MutableOptionalPluginSource;
  constructGraphNode?: (
    metaData: DenoModuleMetaData<PE>,
  ) => fr.PluginGraphNode;
  activate?: (
    ac: DenoModuleActivateContext<PE>,
  ) => Promise<DenoModuleActivateResult>;
  activateSync?: (
    ac: DenoModuleActivateContext<PE>,
  ) => DenoModuleActivateResult;
  untyped: Record<string, unknown>;
}

export interface TypeScriptModuleRegistrationSupplier<
  PE extends fr.PluginExecutive,
  PS extends fr.PluginsSupplier<PE>,
> {
  (
    executive: PE,
    supplier: PS,
    potential: DenoModulePlugin,
    metaData: DenoModuleMetaData<PE>,
  ): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration>;
}

export interface TypeScriptRegistrarTelemetry extends telem.Instrumentation {
  readonly import: (source: URL) => telem.Instrumentable;
}

export interface TypeScriptRegistrarOptions<PE extends fr.PluginExecutive> {
  readonly validateModule: TypeScriptModuleRegistrationSupplier<
    PE,
    fr.PluginsSupplier<PE>
  >;
  readonly importModule: (src: URL) => Promise<unknown>;
  readonly moduleMetaData: (module: unknown) => DenoModuleMetaData<PE>;
  readonly activate: (
    dmac: DenoModuleActivateContext<PE>,
  ) => Promise<DenoModuleActivateResult>;
  readonly telemetry: TypeScriptRegistrarTelemetry;
}

export interface DenoFunctionModulePlugin<PE extends fr.PluginExecutive>
  extends DenoModulePlugin {
  readonly handler: DenoFunctionModuleHandler<PE>;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly metaData: DenoModuleMetaData<PE>;
}

export function isGeneratorFunction(o: unknown) {
  if (typeof o !== "function") {
    return false;
  }

  const name = o.constructor.name;
  return (name === "GeneratorFunction" || name === "AsyncGeneratorFunction");
}

export function isDenoFunctionModulePlugin<PE extends fr.PluginExecutive>(
  o: unknown,
): o is DenoFunctionModulePlugin<PE> {
  if (isDenoModulePlugin(o)) {
    return "handler" in o && "isAsync" in o && "isGenerator" in o;
  }
  return false;
}

export type DenoFunctionModuleHandlerResult = unknown;

export interface DenoFunctionModuleHandler<PE extends fr.PluginExecutive> {
  (pc: fr.PluginContext<PE>):
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

export interface DenoFunctionModuleActionResult<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> extends fr.ActionResult<PE, PC> {
  readonly dfmhResult: DenoFunctionModuleHandlerResult;
}

export function isDenoFunctionModuleActionResult<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
>(
  o: unknown,
): o is DenoFunctionModuleActionResult<PE, PC> {
  const isDfmaResult = safety.typeGuard<DenoFunctionModuleActionResult<PE, PC>>(
    "dfmhResult",
  );
  return isDfmaResult(o);
}

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
export async function registerDenoFunctionModule<PE extends fr.PluginExecutive>(
  _executive: PE,
  _supplier: fr.PluginsSupplier<PE>,
  potential: DenoModulePlugin,
  metaData: DenoModuleMetaData<PE>,
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
    const handler = moduleDefault as DenoFunctionModuleHandler<PE>;
    const handlerConstrName = handler.constructor.name;
    const isGenerator = (handlerConstrName === "GeneratorFunction" ||
      handlerConstrName === "AsyncGeneratorFunction");
    const isAsync = handlerConstrName === "AsyncFunction" ||
      handlerConstrName === "AsyncGeneratorFunction";
    const plugin:
      & DenoFunctionModulePlugin<PE>
      & fr.Action<PE> = {
        ...potential,
        handler,
        isAsync,
        isGenerator,
        execute: async (context) => {
          const dfmhResult = isAsync
            ? await handler(context)
            : handler(context);
          const actionResult: DenoFunctionModuleActionResult<
            PE,
            fr.PluginContext<PE>
          > = {
            context,
            dfmhResult,
          };
          return actionResult;
        },
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

export function moduleMetaData<PE extends fr.PluginExecutive>(
  module: unknown,
): DenoModuleMetaData<PE> {
  const result: DenoModuleMetaData<PE> = {
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
            metaData: DenoModuleMetaData<PE>,
          ) => fr.PluginGraphNode);
          break;

        case "activate":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.activate = value as ((
            ac: DenoModuleActivateContext<PE>,
          ) => Promise<DenoModuleActivateResult>);
          break;

        case "activateSync":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.activateSync = value as ((
            ac: DenoModuleActivateContext<PE>,
          ) => DenoModuleActivateResult);
          break;
      }
    }
  }

  return result;
}

// deno-lint-ignore require-await
export async function typicalDenoModuleActivate<PE extends fr.PluginExecutive>(
  ac: DenoModuleActivateContext<PE>,
): Promise<
  DenoModuleActivateContext<PE> & DenoModuleActivateResult
> {
  ac.supplier.pluginsGraph.addNode(
    new cxg.Node(ac.context.plugin.source.graphNodeName),
  );
  return {
    ...ac,
    registration: ac.vpr,
  };
}
