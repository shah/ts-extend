import { colors, govnSvcTelemetry as telem, safety } from "./deps.ts";
import * as fr from "./framework.ts";
import { Cache, lruCache } from "./cache.ts";

export interface DenoModulePlugin extends fr.Plugin {
  readonly module: unknown;
}

export const isDenoModulePlugin = safety.typeGuard<DenoModulePlugin>(
  "nature",
  "source",
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
      nature: { identity: "deno-module-function" },
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
