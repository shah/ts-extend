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

export interface TypicalMetricOptions {
  readonly identity?: string;
  readonly markOptions?: PerformanceMarkOptions;
  readonly measureOptions?: PerformanceMeasureOptions;
}

export function typicalMetric(
  options?: TypicalMetricOptions,
): Instrumentable {
  const name = options?.identity || `metric${window.globalMetricsCount}`;
  const result: Instrumentable & {
    measured?: PerformanceMeasure;
  } = {
    marked: performance.mark(name, options?.markOptions),
    measure: (measureOptions?: PerformanceMeasureOptions) => {
      if (!result.measured) {
        result.measured = performance.measure(name, {
          ...(measureOptions || options?.measureOptions),
          start: result.marked.startTime,
        });
      }
      return result.measured;
    },
    baggage: () => {
      return { ...result.marked.detail, ...result.measured?.detail };
    },
  };
  return result; // it's the responsibility of the caller to later call result.measure().
}
