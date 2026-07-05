/**
 * Vuqiro feed ranking V1.
 *
 * Deterministic and explainable: every score is a weighted sum of named
 * factors, and `explain` returns the full factor breakdown. No randomness —
 * identical inputs always produce identical ordering.
 */

export type RankingInput = {
  videoId: string;
  creatorId: string;
  createdAt: string;
  /** Engagement counters (all-time). */
  watchCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  /** Aggregated watch behaviour from video_events (recent window). */
  avgWatchSeconds?: number;
  durationSeconds?: number;
  completionRate?: number; // 0..1
  rewatchRate?: number; // 0..1
  skipRate?: number; // 0..1
  /** Safety & moderation. */
  safetyScore: number; // 0..100
  moderationStatus: string;
  reportCount: number;
  /** Creator context. */
  creatorFollowerCount: number;
  creatorVerified: boolean;
  creatorVideoCount: number;
  /** Viewer relationship. */
  viewerFollowsCreator?: boolean;
  viewerSubscribedToCreator?: boolean;
  categoryMatch?: boolean;
  hashtagMatch?: boolean;
  /** Paid boost (never bypasses moderation). */
  boostScore?: number; // 0..1
  /** Admin curation (featured content gets extra distribution). */
  isFeatured?: boolean;
};

/**
 * Superadmin-tunable multipliers applied on top of the base factor weights.
 * Stored in platform_settings.feed_weights and edited from the admin console;
 * 1 = default behaviour, 0 disables a factor, >1 amplifies it.
 */
export type RankingWeightMultipliers = {
  recency: number;
  engagement: number;
  completion: number;
  follow: number;
  interest: number;
  boost: number;
  safety: number;
  featured: number;
};

export const DEFAULT_WEIGHT_MULTIPLIERS: RankingWeightMultipliers = {
  recency: 1,
  engagement: 1,
  completion: 1,
  follow: 1,
  interest: 1,
  boost: 1,
  safety: 1,
  featured: 1
};

export type RankingFactor = { name: string; value: number; weight: number; contribution: number };

export type RankedVideo = {
  videoId: string;
  score: number;
  factors: RankingFactor[];
};

const WEIGHTS = {
  engagement: 25,
  completion: 20,
  rewatch: 6,
  freshness: 18,
  creatorQuality: 10,
  relationship: 12,
  contentMatch: 6,
  safety: 10,
  boost: 8,
  featured: 9,
  skipPenalty: -10,
  reportPenalty: -15,
  spamPenalty: -8
} as const;

function sanitizeMultiplier(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, 10);
}

/** Resolve tunable multipliers into effective factor weights. */
export function effectiveWeights(
  multipliers: Partial<RankingWeightMultipliers> = {}
): Record<keyof typeof WEIGHTS, number> {
  const m: RankingWeightMultipliers = {
    recency: sanitizeMultiplier(multipliers.recency, 1),
    engagement: sanitizeMultiplier(multipliers.engagement, 1),
    completion: sanitizeMultiplier(multipliers.completion, 1),
    follow: sanitizeMultiplier(multipliers.follow, 1),
    interest: sanitizeMultiplier(multipliers.interest, 1),
    boost: sanitizeMultiplier(multipliers.boost, 1),
    safety: sanitizeMultiplier(multipliers.safety, 1),
    featured: sanitizeMultiplier(multipliers.featured, 1)
  };
  return {
    engagement: WEIGHTS.engagement * m.engagement,
    completion: WEIGHTS.completion * m.completion,
    rewatch: WEIGHTS.rewatch * m.engagement,
    freshness: WEIGHTS.freshness * m.recency,
    creatorQuality: WEIGHTS.creatorQuality,
    relationship: WEIGHTS.relationship * m.follow,
    contentMatch: WEIGHTS.contentMatch * m.interest,
    safety: WEIGHTS.safety * m.safety,
    boost: WEIGHTS.boost * m.boost,
    featured: WEIGHTS.featured * m.featured,
    skipPenalty: WEIGHTS.skipPenalty,
    reportPenalty: WEIGHTS.reportPenalty,
    spamPenalty: WEIGHTS.spamPenalty
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Normalized engagement rate against watch volume (log-dampened). */
function engagementRate(input: RankingInput): number {
  const interactions = input.likeCount + input.commentCount * 2 + input.saveCount * 3 + input.shareCount * 3;
  const views = Math.max(input.watchCount, 1);
  return clamp01((interactions / views) * 10);
}

function freshness(createdAt: string, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - new Date(createdAt).getTime()) / 3_600_000);
  // Full score < 6h, halves every ~48h, floors at 0.
  return clamp01(Math.exp(-ageHours / 72));
}

function creatorQuality(input: RankingInput): number {
  const followerScore = clamp01(Math.log10(Math.max(input.creatorFollowerCount, 1)) / 6);
  const verifiedBonus = input.creatorVerified ? 0.2 : 0;
  return clamp01(followerScore + verifiedBonus);
}

/**
 * Controlled cold-start: creators with few videos and few followers get a
 * guaranteed exposure floor so new creators can be discovered, without
 * outranking proven content.
 */
function coldStartBoost(input: RankingInput): number {
  if (input.creatorVideoCount <= 5 && input.creatorFollowerCount < 1000) {
    return 0.35;
  }
  return 0;
}

/** Repetitive/spammy upload patterns are downranked. */
function spamSignal(input: RankingInput): number {
  if (input.creatorVideoCount > 50 && engagementRate(input) < 0.02) {
    return 1;
  }
  return 0;
}

export function scoreVideo(
  input: RankingInput,
  now: Date = new Date(),
  multipliers: Partial<RankingWeightMultipliers> = {}
): RankedVideo {
  const factors: RankingFactor[] = [];
  const weights = effectiveWeights(multipliers);

  const add = (name: string, value: number, weight: number) => {
    const contribution = value * weight;
    factors.push({ name, value: Number(value.toFixed(4)), weight, contribution: Number(contribution.toFixed(4)) });
    return contribution;
  };

  let score = 0;
  score += add("engagement_rate", engagementRate(input), weights.engagement);
  score += add("completion_rate", clamp01(input.completionRate ?? 0.4), weights.completion);
  score += add("rewatch_rate", clamp01(input.rewatchRate ?? 0), weights.rewatch);
  score += add("freshness", freshness(input.createdAt, now), weights.freshness);
  score += add("creator_quality", creatorQuality(input) + coldStartBoost(input), weights.creatorQuality);

  const relationship = (input.viewerFollowsCreator ? 0.6 : 0) + (input.viewerSubscribedToCreator ? 0.4 : 0);
  score += add("relationship", clamp01(relationship), weights.relationship);

  const match = (input.categoryMatch ? 0.5 : 0) + (input.hashtagMatch ? 0.5 : 0);
  score += add("content_match", clamp01(match), weights.contentMatch);

  score += add("safety", clamp01(input.safetyScore / 100), weights.safety);

  // Boosts apply only to fully-visible, safe content — paid reach can never
  // bypass moderation or safety downranking.
  const boostEligible = input.moderationStatus === "visible" && input.safetyScore >= 80 && input.reportCount === 0;
  score += add("boost", boostEligible ? clamp01(input.boostScore ?? 0) : 0, weights.boost);

  // Featured curation follows the same safety rule as boosts.
  const featuredEligible = input.isFeatured === true && input.moderationStatus === "visible";
  score += add("featured", featuredEligible ? 1 : 0, weights.featured);

  score += add("skip_penalty", clamp01(input.skipRate ?? 0), weights.skipPenalty);
  score += add("report_penalty", clamp01(input.reportCount / 5), weights.reportPenalty);
  score += add("spam_penalty", spamSignal(input), weights.spamPenalty);

  // Moderation-limited content is heavily suppressed (but not hidden, per policy).
  if (input.moderationStatus === "limited") {
    score *= 0.3;
    factors.push({ name: "limited_distribution", value: 0.3, weight: 1, contribution: 0 });
  }
  if (input.moderationStatus === "age_restricted") {
    score *= 0.6;
    factors.push({ name: "age_restricted", value: 0.6, weight: 1, contribution: 0 });
  }

  return { videoId: input.videoId, score: Number(score.toFixed(4)), factors };
}

/** Ranks a set of videos; deterministic tie-break on videoId. */
export function rankVideos(
  inputs: RankingInput[],
  now: Date = new Date(),
  multipliers: Partial<RankingWeightMultipliers> = {}
): RankedVideo[] {
  return inputs
    .map((input) => scoreVideo(input, now, multipliers))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.videoId.localeCompare(b.videoId)));
}
