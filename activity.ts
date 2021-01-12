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
