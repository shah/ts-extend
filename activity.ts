import { safety } from "./deps.ts";

export type PluginActivityMessage = string;

export interface PluginActivity {
  readonly message: PluginActivityMessage;
}

export function activity(
  message: string,
  defaults?: Partial<Omit<PluginActivity, "message">>,
): PluginActivity {
  return {
    message,
    ...defaults,
  };
}

export interface PluginActivityReporter {
  (a: PluginActivity, options?: { dryRun?: boolean }): void;
}

export interface PluginActivityReporterSupplier {
  readonly onActivity: PluginActivityReporter;
}

export const isPluginActivityReporterSupplier = safety.typeGuard<
  PluginActivityReporterSupplier
>("onActivity");
