import { colors, govnSvcTelemetry as telem, safety } from "./deps.ts";
import * as fr from "./framework.ts";
import { Cache, lruCache } from "./cache.ts";

export interface DenoModulePlugin extends fr.Plugin {
  readonly module: unknown;
}

export const isDenoModulePlugin = safety.typeGuard<DenoModulePlugin>(
  "nature",
  "source",
  "registerNode",
  "module",
);

export interface DenoModuleActivateContext<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
> extends fr.ActivateContext<PE, PEC, PS> {
  readonly metaData: DenoModuleMetaData<PE, PEC, PS>;
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivateResult<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
  DMAC extends DenoModuleActivateContext<PE, PEC, PS>,
> extends fr.ActivateResult<PE, PEC, PS, DMAC> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivatable<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
  DMAC extends DenoModuleActivateContext<PE, PEC, PS>,
  DMAR extends DenoModuleActivateResult<PE, PEC, PS, DMAC>,
> extends fr.Activatable<PE, PEC, PS, DMAC, DMAR> {
}

// deno-lint-ignore no-empty-interface
export interface DenoModuleActivatableSync<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
  DMAC extends DenoModuleActivateContext<PE, PEC, PS>,
  DMAR extends DenoModuleActivateResult<PE, PEC, PS, DMAC>,
> extends fr.ActivatableSync<PE, PEC, PS, DMAC, DMAR> {
}

export function isDenoModuleActivatablePlugin<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
  DMAC extends DenoModuleActivateContext<PE, PEC, PS>,
  DMAR extends DenoModuleActivateResult<PE, PEC, PS, DMAC>,
>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatable<PE, PEC, PS, DMAC, DMAR> {
  if (isDenoModulePlugin(o)) {
    return "activate" in o;
  }
  return false;
}

export function isDenoModuleActivatableSyncPlugin<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
  DMAC extends DenoModuleActivateContext<PE, PEC, PS>,
  DMAR extends DenoModuleActivateResult<PE, PEC, PS, DMAC>,
>(
  o: unknown,
): o is DenoModulePlugin & DenoModuleActivatableSync<PE, PEC, PS, DMAC, DMAR> {
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
export interface DenoModuleMetaData<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
> extends fr.MutableOptionalPluginsGraphParticipant {
  nature: fr.MutableOptionalPluginNature;
  source: fr.MutableOptionalPluginSource;
  constructGraphNode?: (
    metaData: DenoModuleMetaData<PE, PEC, PS>,
  ) => fr.PluginGraphNode;
  activate?: (
    ac: DenoModuleActivateContext<PE, PEC, PS>,
  ) => Promise<
    DenoModuleActivateResult<
      PE,
      PEC,
      PS,
      DenoModuleActivateContext<PE, PEC, PS>
    >
  >;
  activateSync?: (
    ac: DenoModuleActivateContext<PE, PEC, PS>,
  ) => DenoModuleActivateResult<
    PE,
    PEC,
    PS,
    DenoModuleActivateContext<PE, PEC, PS>
  >;

  untyped: Record<string, unknown>;
}

export interface TypeScriptModuleRegistrationSupplier<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
> {
  (
    executive: PE,
    supplier: PS,
    potential: DenoModulePlugin,
    metaData: DenoModuleMetaData<PE, PEC, PS>,
  ): Promise<fr.ValidPluginRegistration | fr.InvalidPluginRegistration>;
}

export interface TypeScriptRegistrarTelemetry extends telem.Instrumentation {
  readonly import: (source: URL) => telem.Instrumentable;
}

export interface TypeScriptRegistrarOptions<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
> {
  readonly validateModule: TypeScriptModuleRegistrationSupplier<PE, PEC, PS>;
  readonly importModule: (src: URL) => Promise<unknown>;
  readonly moduleMetaData: (module: unknown) => DenoModuleMetaData<PE, PEC, PS>;
  readonly telemetry: TypeScriptRegistrarTelemetry;
}

export interface DenoFunctionModulePlugin<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> extends DenoModulePlugin {
  readonly handler: DenoFunctionModuleHandler<PE, PC>;
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

export function isDenoFunctionModulePlugin<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
>(
  o: unknown,
): o is DenoFunctionModulePlugin<PE, PC> {
  if (isDenoModulePlugin(o)) {
    return "handler" in o && "isAsync" in o && "isGenerator" in o;
  }
  return false;
}

export type DenoFunctionModuleHandlerResult = unknown;

export interface DenoFunctionModuleHandler<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
> {
  (pc: PC):
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

export interface ModuleCacheEntry {
  readonly source: URL;
  readonly module: unknown;
}

const cachedModules: Cache<ModuleCacheEntry> = lruCache();

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
  const key = source.toString();
  let mce = cachedModules[source.toString()];
  if (!mce) {
    mce = {
      source,
      module: await importUncachedModule(source, telemetry),
    };
    cachedModules[key] = mce;
  }
  return mce.module;
}

export async function registerDenoFunctionModule<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
  PS extends fr.PluginsSupplier,
>(
  executive: PE,
  supplier: PS,
  potential: DenoModulePlugin,
  metaData: DenoModuleMetaData<PE, PC, PS>,
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
    const handler = moduleDefault as DenoFunctionModuleHandler<PE, PC>;
    const handlerConstrName = handler.constructor.name;
    const isGenerator = (handlerConstrName === "GeneratorFunction" ||
      handlerConstrName === "AsyncGeneratorFunction");
    const isAsync = handlerConstrName === "AsyncFunction" ||
      handlerConstrName === "AsyncGeneratorFunction";
    const plugin:
      & DenoFunctionModulePlugin<PE, PC>
      & fr.Action<PE, PC, fr.ActionResult<PE, PC>> = {
        ...potential,
        handler,
        isAsync,
        isGenerator,
        execute: async (context) => {
          const dfmhResult = isAsync
            ? await handler(context)
            : handler(context);
          const actionResult: DenoFunctionModuleActionResult<PE, PC> = {
            context,
            dfmhResult,
          };
          return actionResult;
        },
      };
    const result: fr.ValidPluginRegistration = {
      source: potential.source,
      plugin,
    };
    if (
      isDenoModuleActivatablePlugin<
        PE,
        PC,
        PS,
        DenoModuleActivateContext<PE, PC, PS>,
        DenoModuleActivateResult<
          PE,
          PC,
          PS,
          DenoModuleActivateContext<PE, PC, PS>
        >
      >(plugin)
    ) {
      const ar = await plugin.activate({
        context: { container: executive } as PC,
        metaData,
        supplier,
        vpr: result,
      });
      return ar.registration;
    }
    if (
      isDenoModuleActivatableSyncPlugin<
        PE,
        PC,
        PS,
        DenoModuleActivateContext<PE, PC, PS>,
        DenoModuleActivateResult<
          PE,
          PC,
          PS,
          DenoModuleActivateContext<PE, PC, PS>
        >
      >(plugin)
    ) {
      const ar = plugin.activateSync({
        context: { container: executive } as PC,
        metaData,
        supplier,
        vpr: result,
      });
      return ar.registration;
    }
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

export function moduleMetaData<
  PE extends fr.PluginExecutive,
  PEC extends fr.PluginExecutiveContext<PE>,
  PS extends fr.PluginsSupplier,
>(module: unknown): DenoModuleMetaData<PE, PEC, PS> {
  const result: DenoModuleMetaData<PE, PEC, PS> = {
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
        case "registerNode":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.registerNode =
            value as ((graph: fr.PluginsGraph) => fr.PluginGraphNode);
          break;

        case "constructGraphNode":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.constructGraphNode = value as ((
            metaData: DenoModuleMetaData<PE, PEC, PS>,
          ) => fr.PluginGraphNode);
          break;

        case "activate":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.activate = value as ((
            ac: DenoModuleActivateContext<PE, PEC, PS>,
          ) => Promise<
            DenoModuleActivateResult<
              PE,
              PEC,
              PS,
              DenoModuleActivateContext<PE, PEC, PS>
            >
          >);
          break;

        case "activateSync":
          // TODO: enhance type checking because a function could be defined incorrectly at runtime
          result.activateSync = value as ((
            ac: DenoModuleActivateContext<PE, PEC, PS>,
          ) => DenoModuleActivateResult<
            PE,
            PEC,
            PS,
            DenoModuleActivateContext<PE, PEC, PS>
          >);
          break;
      }
    }
  }

  return result;
}
