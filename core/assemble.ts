import { safety } from "./deps.ts";

export interface AssemblyContext {
  readonly isInAssemblyPipe?: boolean;
}

export interface AssemblyResult<T> {
  readonly target: T;
}

export function isAssemblyResult<T>(
  o: unknown,
): o is AssemblyResult<T> {
  return safety.typeGuard<AssemblyResult<T>>("target")(o);
}

export interface Assembler<T> {
  (
    target: T | AssemblyResult<T>,
    ac?: AssemblyContext,
  ): Promise<T | AssemblyResult<T>>;
}

export interface AssemblerSync<T> {
  (
    target: T | AssemblyResult<T>,
    ac?: AssemblyContext,
  ): T | AssemblyResult<T>;
}

export interface AssemblyPipe<T> {
  (
    initTarget: T,
    ac?: AssemblyContext,
  ): Promise<T | AssemblyResult<T>>;
}

export interface AssemblyPipeSync<T> {
  (
    initTarget: T,
    ac?: AssemblyContext,
  ): T | AssemblyResult<T>;
}

export interface AssemblyTransformerProvenance<T> {
  readonly from: T;
  readonly position: number;
  readonly remarks?: string;
}

export interface AssemblyTransformerProvenanceSupplier<T> {
  readonly isTransformed: AssemblyTransformerProvenance<T>;
}

export function isAssemblyTransformerProvenanceSupplier<T>(
  o: unknown,
): o is AssemblyTransformerProvenanceSupplier<T> {
  return safety.typeGuard<AssemblyTransformerProvenanceSupplier<T>>(
    "isTransformed",
  )(o);
}

export function isTransformedAssemblyResult<T>(
  o: unknown,
): o is AssemblyResult<T> & AssemblyTransformerProvenanceSupplier<T> {
  return isAssemblyResult(o) &&
    safety.typeGuard<AssemblyTransformerProvenanceSupplier<T>>(
      "isTransformed",
    )(o);
}

export interface Diagnosable {
  readonly diagnostics: string[];
  readonly uniqueDiagnostics: () => string[];
  readonly mostRecentDiagnostic: () => string | undefined;
}

export const isDiagnosable = safety.typeGuard<Diagnosable>(
  "diagnostics",
  "uniqueDiagnostics",
  "mostRecentDiagnostic",
);

export interface AssemblyIssue<T> extends AssemblyResult<T> {
  readonly isAssemblyIssue: true;
}

export function isAssemblyIssue<T>(
  o: unknown,
): o is AssemblyIssue<T> {
  return safety.typeGuard<AssemblyIssue<T>>(
    "isAssemblyIssue",
  )(o);
}

export interface IrrecoverableAssemblyIssue {
  readonly isRecoverableAssemblyIssue: boolean;
}

export const isAssemblyIssueIrrecoverable = safety.typeGuard<
  IrrecoverableAssemblyIssue
>("isRecoverableAssemblyIssue");

export interface AssemblyException<T, E extends Error = Error>
  extends AssemblyIssue<T> {
  readonly isAssemblyException: true;
  readonly exception: E;
}

export function isAssemblyException<T, E extends Error = Error>(
  o: unknown,
): o is AssemblyException<T, E> {
  return safety.typeGuard<AssemblyException<T, E>>(
    "isAssemblyException",
  )(o);
}

export function assemblyPipe<T>(
  ...assemblers: Assembler<T>[]
): AssemblyPipe<T> {
  return async (
    target: T,
    ac?: AssemblyContext,
  ): Promise<T | AssemblyResult<T>> => {
    if (assemblers.length == 0) return target;

    let result: T | AssemblyResult<T> = target;
    for (const assemble of assemblers) {
      result = await assemble(result, ac);
    }
    return result;
  };
}

export function assemblyPipeSync<T>(
  ...assemblers: AssemblerSync<T>[]
): AssemblyPipeSync<T> {
  return (
    target: T,
    ac?: AssemblyContext,
  ): T | AssemblyResult<T> => {
    if (assemblers.length == 0) return target;

    let result: T | AssemblyResult<T> = target;
    for (const assemble of assemblers) {
      result = assemble(result, ac);
    }
    return result;
  };
}

export function assemblyTransformationSource<T>(
  source: T,
  remarks?: string,
): AssemblyTransformerProvenance<T> {
  return {
    from: source,
    position: nextAssemblyTransformerProvenancePosition(source),
    remarks,
  };
}

export function nextAssemblyTransformerProvenancePosition<T>(
  o:
    | T
    | AssemblyTransformerProvenance<T>
    | AssemblyTransformerProvenanceSupplier<T>,
): number {
  if (!o || typeof o !== "object") return 0;
  if ("position" in o) {
    return o.position + 1;
  }
  if ("isTransformed" in o) {
    return o.isTransformed.position + 1;
  }
  return 0;
}

export function assemblyIssue<T>(
  o: T | AssemblyResult<T>,
  diagnostic: string | string[],
): AssemblyIssue<T> & Diagnosable {
  const diagnostics: string | string[] = Array.isArray(diagnostic)
    ? [...diagnostic]
    : [diagnostic];
  if (isAssemblyIssue<T>(o) && isDiagnosable(o)) {
    o.diagnostics.push(...diagnostics);
    return o;
  }
  const uniqueDiagnostics = (): string[] => {
    return [...new Set<string>(diagnostics)];
  };
  const mostRecentDiagnostic = () => {
    return diagnostics[diagnostics.length - 1];
  };
  if (isAssemblyResult<T>(o)) {
    return {
      ...o,
      isAssemblyIssue: true,
      diagnostics: diagnostics,
      uniqueDiagnostics: uniqueDiagnostics,
      mostRecentDiagnostic: mostRecentDiagnostic,
    };
  }
  return {
    isAssemblyIssue: true,
    target: o,
    diagnostics: diagnostics,
    uniqueDiagnostics: uniqueDiagnostics,
    mostRecentDiagnostic: mostRecentDiagnostic,
  };
}

export function assemblyException<T>(
  o: T | AssemblyResult<T>,
  exception: Error,
  diagnostic?: string | string[],
): AssemblyException<T> {
  if (diagnostic) {
    return {
      ...assemblyIssue(o, diagnostic),
      isAssemblyException: true,
      exception: exception,
    };
  }
  if (isAssemblyResult<T>(o)) {
    return {
      ...o,
      isAssemblyIssue: true,
      isAssemblyException: true,
      exception: exception,
    };
  }
  return {
    isAssemblyIssue: true,
    target: o,
    isAssemblyException: true,
    exception: exception,
  };
}
