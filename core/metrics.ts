declare global {
  interface Window {
    readonly globalMetricsCount: number;
  }
}

if (typeof window.globalMetricsCount === "undefined") {
  (window.globalMetricsCount as number) = 0;
}

export interface Instrumentable {
  readonly marked: PerformanceMark;
  readonly measure: (
    options?: PerformanceMeasureOptions,
  ) => PerformanceMeasure;
  readonly baggage: () => Record<string, unknown> | undefined;
}
