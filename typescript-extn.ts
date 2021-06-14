import { colors, safety, safety as tsExtn } from "./deps.ts";
import * as fr from "./framework.ts";
import { Cache, lruCache } from "./cache.ts";

export interface DenoModulePlugin extends fr.Plugin {
  readonly module: unknown;
}

export const isDenoModulePlugin = tsExtn.typeGuard<DenoModulePlugin>(
  "nature",
  "source",
  "module",
);

export interface TypeScriptModuleRegistrationSupplier {
  (
    potential: DenoModulePlugin,
  ): fr.ValidPluginRegistration | fr.InvalidPluginRegistration;
}

export interface TypeScriptRegistrarOptions {
  readonly validateModule: TypeScriptModuleRegistrationSupplier;
  readonly importModule: (src: URL) => Promise<unknown>;
}

export interface DenoFunctionModulePlugin<T extends fr.PluginExecutive>
  extends DenoModulePlugin {
  readonly handler: DenoFunctionModuleHandler<T>;
  readonly isAsync: boolean;
}

export function isDenoFunctionModulePlugin<T extends fr.PluginExecutive>(
  o: unknown,
): o is DenoFunctionModulePlugin<T> {
  if (isDenoModulePlugin(o)) {
    return "handler" in o && "isAsync" in o;
  }
  return false;
}

// deno-lint-ignore no-empty-interface
export interface DenoFunctionModuleHandlerResult {
}

export interface DenoFunctionModuleHandler<T extends fr.PluginExecutive> {
  (
    pc: fr.PluginContext<T>,
  ): Promise<DenoFunctionModuleHandlerResult> | DenoFunctionModuleHandlerResult;
}

export interface DenoFunctionModuleActionResult<T extends fr.PluginExecutive>
  extends fr.ActionResult<T> {
  readonly dfmhResult: DenoFunctionModuleHandlerResult;
}

export function isDenoFunctionModuleActionResult<T extends fr.PluginExecutive>(
  o: unknown,
): o is DenoFunctionModuleActionResult<T> {
  const isDfmaResult = safety.typeGuard<DenoFunctionModuleActionResult<T>>(
    "dfmhResult",
  );
  return isDfmaResult(o);
}

export interface ModuleCacheEntry {
  readonly source: URL;
  readonly module: unknown;
}

const cachedModules: Cache<ModuleCacheEntry> = lruCache();

export async function importUncachedModule(src: URL): Promise<unknown> {
  return await import(src.toString());
}

export async function importCachedModule(source: URL): Promise<unknown> {
  const key = source.toString();
  let mce = cachedModules[source.toString()];
  if (!mce) {
    mce = {
      source,
      module: await importUncachedModule(source),
    };
    cachedModules[key] = mce;
  }
  return mce.module;
}

export function registerDenoFunctionModule<
  T extends fr.PluginExecutive,
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
    const handler = moduleDefault as DenoFunctionModuleHandler<T>;
    const isAsync = handler.constructor.name === "AsyncFunction";
    const plugin: DenoFunctionModulePlugin<T> & fr.Action<T> = {
      ...potential,
      nature: { identity: "deno-module-function" },
      handler,
      isAsync,
      execute: async (pc: fr.PluginContext<T>): Promise<fr.ActionResult<T>> => {
        const dfmhResult = isAsync ? await handler(pc) : handler(pc);
        const actionResult: DenoFunctionModuleActionResult<T> = {
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
