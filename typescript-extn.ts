import { colors, govnSvcTelemetry as telem, safety } from "./deps.ts";
import * as fr from "./framework.ts";
import { Cache, lruCache } from "./cache.ts";

export interface DenoModulePlugin extends fr.Plugin {
  readonly module: unknown;
}

/**
 * DenoModuleMetaData represents Plugin information defined as constants in
 * a Deno module. Plugin details defined in this interface may be overridden
 * by a Deno module plugin.
 */
export interface DenoModuleMetaData
  extends fr.MutableOptionalPluginsGraphParticipant {
  nature: fr.MutableOptionalPluginNature;
  source: fr.MutableOptionalPluginSource;
  constructGraphNode?: (metaData: DenoModuleMetaData) => fr.PluginGraphNode;
}

export const isDenoModulePlugin = safety.typeGuard<DenoModulePlugin>(
  "nature",
  "source",
  "registerNode",
  "module",
);

export interface TypeScriptModuleRegistrationSupplier {
  (
    potential: DenoModulePlugin,
  ): fr.ValidPluginRegistration | fr.InvalidPluginRegistration;
}

export interface TypeScriptRegistrarTelemetry extends telem.Instrumentation {
  readonly import: (source: URL) => telem.Instrumentable;
}

export interface TypeScriptRegistrarOptions {
  readonly validateModule: TypeScriptModuleRegistrationSupplier;
  readonly importModule: (src: URL) => Promise<unknown>;
  readonly moduleMetaData: (module: unknown) => DenoModuleMetaData;
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

export function registerDenoFunctionModule<
  PE extends fr.PluginExecutive,
  PC extends fr.PluginContext<PE>,
>(
  potential: DenoModulePlugin,
): fr.ValidPluginRegistration | fr.InvalidPluginRegistration {
  // deno-lint-ignore no-explicit-any
  const module = potential.module as any;
  const moduleDefault = module.default;

  if (fr.isValidPluginRegistration(moduleDefault)) {
    return moduleDefault;
  }

  if (isDenoModulePlugin(moduleDefault)) {
    const result: fr.ValidPluginRegistration = {
      plugin: moduleDefault,
      source: moduleDefault.source,
    };
    return result;
  }

  if (typeof moduleDefault === "function") {
    const handler = moduleDefault as DenoFunctionModuleHandler<PE, PC>;
    const handlerConstrName = handler.constructor.name;
    const isGenerator = (handlerConstrName === "GeneratorFunction" ||
      handlerConstrName === "AsyncGeneratorFunction");
    const isAsync = handlerConstrName === "AsyncFunction" ||
      handlerConstrName === "AsyncGeneratorFunction";
    const plugin: DenoFunctionModulePlugin<PE, PC> & fr.Action<PE, PC> = {
      ...potential,
      handler,
      isAsync,
      isGenerator,
      execute: async (pc: PC): Promise<fr.ActionResult<PE, PC>> => {
        const dfmhResult = isAsync ? await handler(pc) : handler(pc);
        const actionResult: DenoFunctionModuleActionResult<PE, PC> = {
          pc,
          dfmhResult,
        };
        return actionResult;
      },
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

export function moduleMetaData(module: unknown): DenoModuleMetaData {
  const result: DenoModuleMetaData = {
    nature: {},
    source: {},
  };
  for (const entry of Object.entries(module as Record<string, unknown>)) {
    const [key, value] = entry;
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
          result.constructGraphNode =
            value as ((metaData: DenoModuleMetaData) => fr.PluginGraphNode);
          break;
      }
    }
  }

  return result;
}
