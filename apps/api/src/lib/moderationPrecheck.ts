/**
 * Pre-publication moderation check (V1).
 *
 * A lightweight lexical screen that routes suspicious uploads to the human
 * moderation queue before they reach the feed. A real ML/vendor scan can be
 * plugged in here later without changing the pipeline.
 */

const FLAGGED_TERMS = [
  "cp",
  "csam",
  "gore",
  "beheading",
  "rape",
  "terror attack",
  "school shooting",
  "hitman",
  "buy followers",
  "free coins hack",
  "onlyfans leak"
];

export type PrecheckResult = {
  eligible: boolean;
  safetyScore: number;
  flaggedTerms: string[];
};

export function precheckModeration(caption: string, hashtags: string[]): PrecheckResult {
  const haystack = `${caption} ${hashtags.join(" ")}`.toLowerCase();
  const flagged = FLAGGED_TERMS.filter((term) => haystack.includes(term));
  if (flagged.length > 0) {
    return { eligible: false, safetyScore: 20, flaggedTerms: flagged };
  }
  return { eligible: true, safetyScore: 100, flaggedTerms: [] };
}
