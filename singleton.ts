import * as metrics from "./metrics.ts";

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
  readonly identity: SingletonIdentity;
  isValueAssigned: boolean;
  assignedValue?: T;
  lifecycleMetric: metrics.Instrumentable;
  constructionMetric?: metrics.Instrumentable;
  destructionMetric?: metrics.Instrumentable;
  valueAccessedCount: number;
}

export interface SingletonState<T> extends StatefulSingleton<T> {
  readonly destroy?: (state: SingletonState<T>) => Promise<void>;
}

export interface SingletonStateSync<T> extends StatefulSingleton<T> {
  readonly destroy?: (state: SingletonStateSync<T>) => void;
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
      isValueAssigned: false,
      valueAccessedCount: 0,
      lifecycleMetric: metrics.typicalMetric(),
      value: async (onUndefinedValue) => {
        if (!result.isValueAssigned) {
          result.constructionMetric = metrics.typicalMetric();
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
      destroy: options?.destroy,
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
      isValueAssigned: false,
      valueAccessedCount: 0,
      lifecycleMetric: metrics.typicalMetric(),
      value: (onUndefinedValue) => {
        if (!result.isValueAssigned) {
          result.constructionMetric = metrics.typicalMetric();
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
      destroy: options?.destroy,
    };
    this.syncSingletons.push(result);
    return result;
  }

  async destroy() {
    for (const singleton of this.asyncSingletons) {
      if (singleton.destroy) {
        singleton.destructionMetric = metrics.typicalMetric();
        await singleton.destroy(singleton);
        singleton.destructionMetric.measure();
      }
      // the singleton metric is created at activation and "done" on destroy
      singleton.lifecycleMetric.measure();
    }

    for (const singleton of this.syncSingletons) {
      if (singleton.destroy) {
        singleton.destructionMetric = metrics.typicalMetric();
        singleton.destroy(singleton);
        singleton.destructionMetric.measure();
      }
      // the singleton metric is created at activation and "done" on destroy
      singleton.lifecycleMetric.measure();
    }
  }

  info() {
    for (const singleton of this.asyncSingletons) {
      console.dir(singleton);
    }

    for (const singleton of this.syncSingletons) {
      console.dir(singleton);
    }
  }
}
