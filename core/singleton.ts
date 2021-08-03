import * as metrics from "./metrics.ts";
import * as typical from "./typical.ts";

declare global {
  interface Window {
    readonly globalSingletons: SingletonsManager;
  }
}

export interface Singleton<T> {
  readonly value: (
    onUndefinedValue?: (state: SingletonState<T>) => Promise<T>,
  ) => Promise<T>;
}

export interface SingletonSync<T> {
  readonly value: (onUndefinedValue?: (state: SingletonStateSync<T>) => T) => T;
}

export type SingletonIdentity = string;

export interface SingletonOptions {
  readonly identity?: SingletonIdentity;
}

export interface Singletons {
  readonly singleton: <T>(
    construct: (state: SingletonState<T>) => Promise<T>,
    options?: SingletonOptions & {
      readonly onUndefinedValue?: (state: SingletonState<T>) => Promise<T>;
      readonly destroy?: (state: SingletonState<T>) => Promise<void>;
    },
  ) => Singleton<T>;
  readonly singletonSync: <T>(
    construct: (state: SingletonStateSync<T>) => T,
    options?: SingletonOptions & {
      readonly onUndefinedValue?: (state: SingletonStateSync<T>) => T;
      readonly destroy?: (tate: SingletonStateSync<T>) => void;
    },
  ) => SingletonSync<T>;
}

export interface StatefulSingleton<T> {
  isActive: boolean;
  readonly identity: SingletonIdentity;
  isValueAssigned: boolean;
  assignedValue?: T;
  lifecycleMetric: metrics.Instrumentable;
  constructionMetric?: metrics.Instrumentable;
  destructionMetric?: metrics.Instrumentable;
  valueAccessedCount: number;
}

export interface SingletonState<T> extends StatefulSingleton<T> {
  readonly destroy: () => Promise<void>;
}

export interface SingletonStateSync<T> extends StatefulSingleton<T> {
  readonly destroy: () => void;
}

export class SingletonsManager implements Singletons {
  static globalInstance(): Singletons {
    if (!window.globalSingletons) {
      // deno-lint-ignore no-explicit-any
      (window.globalSingletons as any) = new SingletonsManager();
    }
    return window.globalSingletons;
  }

  // deno-lint-ignore no-explicit-any
  readonly asyncSingletons: (Singleton<any> & SingletonState<any>)[] = [];
  // deno-lint-ignore no-explicit-any
  readonly syncSingletons: (SingletonSync<any> & SingletonStateSync<any>)[] =
    [];

  singleton<T>(
    construct: (state: SingletonState<T>) => Promise<T>,
    options?: SingletonOptions & {
      readonly onUndefinedValue?: (state: SingletonState<T>) => Promise<T>;
      readonly destroy?: (state: SingletonState<T>) => Promise<void>;
    },
  ): Singleton<T> & SingletonState<T> {
    const identity = options?.identity ||
      (`singleton${this.asyncSingletons.length + 1}`);
    const result: Singleton<T> & SingletonState<T> = {
      identity,
      isActive: true,
      isValueAssigned: false,
      valueAccessedCount: 0,
      lifecycleMetric: typical.typicalMetric(),
      value: async (onUndefinedValue) => {
        if (!result.isValueAssigned) {
          result.constructionMetric = typical.typicalMetric();
          result.assignedValue = await construct(result);
          result.isValueAssigned = true;
          result.constructionMetric.measure();
        }
        result.valueAccessedCount++;
        const defaultValue = onUndefinedValue || options?.onUndefinedValue;
        return typeof result.assignedValue === "undefined"
          ? (defaultValue ? await defaultValue(result) : undefined) as T
          : result.assignedValue as T;
      },
      destroy: async () => {
        if (result.isActive) {
          result.destructionMetric = typical.typicalMetric();
          if (options?.destroy) {
            await options.destroy(result);
          }
          result.destructionMetric.measure();
          result.lifecycleMetric.measure();
          result.isActive = false;
        }
      },
    };
    this.asyncSingletons.push(result);
    return result;
  }

  singletonSync<T>(
    construct: (state: SingletonStateSync<T>) => T,
    options?: SingletonOptions & {
      readonly onUndefinedValue?: (state: SingletonStateSync<T>) => T;
      readonly destroy?: (state: SingletonStateSync<T>) => void;
    },
  ): SingletonSync<T> & SingletonStateSync<T> {
    const identity = options?.identity ||
      (`singletonSync${this.asyncSingletons.length + 1}`);
    const result: SingletonSync<T> & SingletonStateSync<T> = {
      identity,
      isActive: true,
      isValueAssigned: false,
      valueAccessedCount: 0,
      lifecycleMetric: typical.typicalMetric(),
      value: (onUndefinedValue) => {
        if (!result.isValueAssigned) {
          result.constructionMetric = typical.typicalMetric();
          result.assignedValue = construct(result);
          result.isValueAssigned = true;
          result.constructionMetric.measure();
        }
        result.valueAccessedCount++;
        const defaultValue = onUndefinedValue || options?.onUndefinedValue;
        return typeof result.assignedValue === "undefined"
          ? (defaultValue ? defaultValue(result) : undefined) as T
          : result.assignedValue as T;
      },
      destroy: () => {
        if (result.isActive) {
          result.destructionMetric = typical.typicalMetric();
          if (options?.destroy) {
            options.destroy(result);
          }
          result.destructionMetric.measure();
          result.lifecycleMetric.measure();
          result.isActive = false;
        }
      },
    };
    this.syncSingletons.push(result);
    return result;
  }

  async destroy() {
    for (const singleton of this.asyncSingletons) {
      await singleton.destroy();
    }

    for (const singleton of this.syncSingletons) {
      singleton.destroy();
    }
  }
}
