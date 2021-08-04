import { safety } from "./deps.ts";

export type ContributionIdentity = string;

/**
 * MutableOptionalContributionSource is useful during the initialization process of
 * contribution instances but should not be used after initialization.
 */
export interface MutableOptionalContributionSource {
  contributorID?: ContributionIdentity;
}

export type ContributionSource = Readonly<
  Required<MutableOptionalContributionSource>
>;

export interface ContributionSourceSupplier {
  readonly source: ContributionSource;
}

export const isContribution = safety.typeGuard<ContributionSourceSupplier>(
  "source",
);

// deno-lint-ignore no-empty-interface
export interface Contribution {
}

export interface TextContribution extends Contribution {
  readonly text: string;
}

export interface FlexibleTextContribution extends Contribution {
  readonly flexibleText: string | (() => string);
}

export interface FlexibleContentContribution extends Contribution {
  readonly flexibleContent: string | Uint8Array | (() => string | Uint8Array);
}

export interface SingleUseWriterContribution extends Contribution, Deno.Writer {
  readonly isSingleUseWriterContribution: true;
}

export interface FlexibleSingleUseWriterContribution extends Contribution {
  readonly flexibleSingleUseWriter: Deno.Writer | (() => Deno.Writer);
}

export interface FlexibleMultiUseWriterContribution extends Contribution {
  readonly flexibleWriter: Deno.Writer | (() => Deno.Writer);
}

export interface OptionalFlexibleContribution
  extends
    Contribution,
    Partial<TextContribution>,
    Partial<FlexibleTextContribution>,
    Partial<FlexibleContentContribution>,
    Partial<SingleUseWriterContribution>,
    Partial<FlexibleSingleUseWriterContribution>,
    Partial<FlexibleMultiUseWriterContribution> {
}

export type FlexibleContribution = safety.RequireAtLeastOne<
  OptionalFlexibleContribution,
  | "text"
  | "flexibleText"
  | "flexibleContent"
  | "write"
  | "flexibleSingleUseWriter"
  | "flexibleWriter"
>;

export const isTextContribution = safety.typeGuard<TextContribution>("text");

export const isFlexibleTextContribution = safety.typeGuard<
  FlexibleTextContribution
>(
  "flexibleText",
);

export const isFlexibleContentContribution = safety.typeGuard<
  FlexibleContentContribution
>(
  "flexibleContent",
);

export const isSingleUseWriterContribution = safety.typeGuard<
  SingleUseWriterContribution
>(
  "write",
);

export const isFlexibleSingleUseWriterContribution = safety.typeGuard<
  FlexibleSingleUseWriterContribution
>("flexibleSingleUseWriter");

export const isFlexibleMultiUseWriterContribution = safety.typeGuard<
  FlexibleMultiUseWriterContribution
>("flexibleWriter");

// deno-lint-ignore no-empty-interface
export interface Contributor {
}

export interface ContributionContext {
  readonly contributor?: FlexibleContribution;
}

export interface SingleArtifactContributor {
  readonly contribution: (cc: ContributionContext) => Promise<Contribution>;
}

export interface SingleArtifactContributorSync {
  readonly contributionSync: (cc: ContributionContext) => Contribution;
}

export interface MultipleArtifactsContributor {
  readonly contributions: (
    cc: ContributionContext,
  ) => Promise<Iterable<FlexibleContentContribution>>;
}

export const isSingleArtifactContributor = safety.typeGuard<
  SingleArtifactContributor
>(
  "contribution",
);

export const isSingleArtifactContributorSync = safety.typeGuard<
  SingleArtifactContributorSync
>(
  "contributionSync",
);

export const isMultipleArtifactsContributor = safety.typeGuard<
  MultipleArtifactsContributor
>(
  "contributions",
);

export function contributionContentTextSync(
  contributor: OptionalFlexibleContribution,
  options?: {
    readonly defaultText?: string | (() => string) | undefined;
    readonly invalidTypeText?: string | (() => string) | undefined;
    readonly textDecoder?: TextDecoder;
  },
): string | undefined {
  if (contributor.text) return contributor.text;
  if (contributor.flexibleText) {
    if (typeof contributor.flexibleText === "string") {
      return contributor.flexibleText;
    }
    return contributor.flexibleText();
  }
  if (contributor.flexibleContent) {
    if (typeof contributor.flexibleContent === "string") {
      return contributor.flexibleContent;
    }
    if (contributor.flexibleContent instanceof Uint8Array) {
      const td = options?.textDecoder || new TextDecoder();
      return td.decode(contributor.flexibleContent);
    }
    const result = contributor.flexibleContent();
    if (typeof result === "string") {
      return result;
    }
    if (result instanceof Uint8Array) {
      const td = options?.textDecoder || new TextDecoder();
      return td.decode(result);
    }
  }
  if (
    contributor.flexibleSingleUseWriter || contributor.flexibleWriter ||
    contributor.write
  ) {
    return options?.invalidTypeText
      ? (typeof options.invalidTypeText == "string"
        ? options.invalidTypeText
        : options.invalidTypeText())
      : `contributionContentTextSync cannot handle async contributor content: keys ${
        Object.keys(contributor).join(", ")
      }`;
  }
  if (options) {
    return options.defaultText
      ? (typeof options.defaultText == "string"
        ? options.defaultText
        : options.defaultText())
      : `No content provided by contributionContentTextSync contributor: keys ${
        Object.keys(contributor).join(", ")
      }}`;
  }
}
