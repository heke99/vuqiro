import { useEffect, useRef, useState } from "react";
import { mockCreatorAnalytics, mockMemberships, mockModerationCases, mockPayoutHolds, mockPayouts, mockVideos } from "@vuqiro/mock-data";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { isDemoContentAllowed } from "../../services/data/demoMode";

export type StudioAnalytics = {
  views: number;
  watchTimeHours: number;
  completionRate: number;
  followersGained: number;
  subscribersGained: number;
  coinTips: number;
  unlockRevenue: number;
  subscriptionRevenue: number;
  payoutPending: number;
  payoutPaid: number;
};

export type StudioVideo = {
  id: string;
  caption: string;
  visibility: string;
  status?: string;
  moderationStatus?: string;
  watchCount: number;
  likeCount: number;
  reportCount?: number;
  createdAt?: string;
};

export type StudioSubscribers = {
  totals: { active: number; gracePeriod: number; cancelled: number };
  byTier: Record<string, number>;
  recent: { handle?: string; tier: string; status: string; startedAt: string }[];
};

export type StudioPayoutInfo = {
  account: { status: string; payoutsEnabled: boolean };
  payableBalance: number;
  pendingBalance: number;
  heldBalance?: number;
  payouts: { id: string; amount: number; currency: string; status: string; failureReason?: string; createdAt: string }[];
  holds: { id: string; reason: string; note?: string; createdAt: string }[];
  minimumPayout: number;
};

export type StudioModeration = {
  warnings: number;
  cases: { id: string; targetType: string; targetId: string; reason: string; status: string; resolvedAction?: string; createdAt: string }[];
};

function mockStudio() {
  return {
    analytics: mockCreatorAnalytics[0] as StudioAnalytics,
    videos: mockVideos
      .filter((video) => video.creatorId === "creator_001")
      .map((video) => ({
        id: video.id,
        caption: video.caption,
        visibility: video.visibility,
        status: video.status,
        moderationStatus: video.moderationStatus,
        watchCount: video.watchCount,
        likeCount: video.likeCount,
        reportCount: video.reportCount,
        createdAt: video.createdAt
      })),
    subscribers: {
      totals: { active: mockMemberships.filter((m) => m.status === "active").length, gracePeriod: 1, cancelled: 1 },
      byTier: { support: 1, plus: 1, premium: 1 },
      recent: mockMemberships.map((membership) => ({
        handle: "supporter",
        tier: membership.tier,
        status: membership.status,
        startedAt: membership.startedAt
      }))
    } as StudioSubscribers,
    payoutInfo: {
      account: { status: "verified", payoutsEnabled: true },
      payableBalance: 534.9,
      pendingBalance: 182.4,
      heldBalance: 0,
      payouts: mockPayouts
        .filter((payout) => payout.creatorId === "creator_001")
        .map((payout) => ({
          id: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
          failureReason: payout.failureReason,
          createdAt: payout.createdAt
        })),
      holds: mockPayoutHolds
        .filter((hold) => hold.creatorId === "creator_001")
        .map((hold) => ({ id: hold.id, reason: hold.reason, note: hold.note, createdAt: hold.createdAt })),
      minimumPayout: 25
    } as StudioPayoutInfo,
    moderation: {
      warnings: 0,
      cases: mockModerationCases.slice(0, 2).map((item) => ({
        id: item.id,
        targetType: item.targetType,
        targetId: item.targetId,
        reason: item.reason,
        status: item.status,
        resolvedAction: item.resolvedAction,
        createdAt: item.createdAt
      }))
    } as StudioModeration
  };
}

/** Zeroed studio state for production builds when the API is unreachable. */
function emptyStudio(): ReturnType<typeof mockStudio> {
  return {
    analytics: {
      views: 0,
      watchTimeHours: 0,
      completionRate: 0,
      followersGained: 0,
      subscribersGained: 0,
      coinTips: 0,
      unlockRevenue: 0,
      subscriptionRevenue: 0,
      payoutPending: 0,
      payoutPaid: 0
    },
    videos: [],
    subscribers: { totals: { active: 0, gracePeriod: 0, cancelled: 0 }, byTier: {}, recent: [] },
    payoutInfo: {
      account: { status: "not_started", payoutsEnabled: false },
      payableBalance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      payouts: [],
      holds: [],
      minimumPayout: 25
    },
    moderation: { warnings: 0, cases: [] }
  };
}

/** Demo values outside production; zeroed values in production builds. */
function studioDefaults(): ReturnType<typeof mockStudio> {
  return isDemoContentAllowed() ? mockStudio() : emptyStudio();
}

type CamelSnake<T> = T; // API returns snake_case for some DB fields; normalized below.

function useStudioResource<T>(path: string, mockValue: T, normalize?: (raw: unknown) => T): { data: T; isLive: boolean; reload: () => void } {
  const [data, setData] = useState<T>(mockValue);
  const [isLive, setIsLive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Normalizers are inline per-hook; keep the latest without re-triggering.
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isApiConfigured()) return;
      try {
        const response = await apiFetch<CamelSnake<unknown>>(path);
        if (!cancelled) {
          setData(normalizeRef.current ? normalizeRef.current(response) : (response as T));
          setIsLive(true);
        }
      } catch {
        // stay on mock data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  return { data, isLive, reload: () => setReloadKey((key) => key + 1) };
}

export function useStudioAnalytics() {
  return useStudioResource<StudioAnalytics>(
    "/creators/me/analytics",
    studioDefaults().analytics,
    (raw) => (raw as { analytics: StudioAnalytics }).analytics
  );
}

export function useStudioVideos() {
  return useStudioResource<StudioVideo[]>("/creators/me/videos", studioDefaults().videos, (raw) => {
    const items = (raw as { items: Record<string, unknown>[] }).items;
    return items.map((item) => ({
      id: String(item.id),
      caption: String(item.caption),
      visibility: String(item.visibility),
      status: item.status ? String(item.status) : undefined,
      moderationStatus: item.moderation_status ? String(item.moderation_status) : (item.moderationStatus as string | undefined),
      watchCount: Number(item.watch_count ?? item.watchCount ?? 0),
      likeCount: Number(item.like_count ?? item.likeCount ?? 0),
      reportCount: Number(item.report_count ?? item.reportCount ?? 0),
      createdAt: (item.created_at ?? item.createdAt) as string | undefined
    }));
  });
}

export function useStudioSubscribers() {
  return useStudioResource<StudioSubscribers>("/creators/me/subscribers", studioDefaults().subscribers, (raw) => {
    const data = raw as { totals: StudioSubscribers["totals"]; byTier: Record<string, number>; recent: Record<string, unknown>[] };
    return {
      totals: data.totals,
      byTier: data.byTier,
      recent: data.recent.map((row) => ({
        handle: row.handle as string | undefined,
        tier: String(row.tier),
        status: String(row.status),
        startedAt: String(row.startedAt ?? row.started_at ?? "")
      }))
    };
  });
}

export function useStudioPayouts() {
  return useStudioResource<StudioPayoutInfo>("/payouts/me", studioDefaults().payoutInfo, (raw) => {
    const data = raw as Record<string, unknown>;
    return {
      account: data.account as StudioPayoutInfo["account"],
      payableBalance: Number(data.payableBalance ?? 0),
      pendingBalance: Number(data.pendingBalance ?? 0),
      heldBalance: Number(data.heldBalance ?? 0),
      payouts: ((data.payouts as Record<string, unknown>[]) ?? []).map((payout) => ({
        id: String(payout.id),
        amount: Number(payout.amount),
        currency: String(payout.currency ?? "USD"),
        status: String(payout.status),
        failureReason: (payout.failure_reason ?? payout.failureReason) as string | undefined,
        createdAt: String(payout.created_at ?? payout.createdAt ?? "")
      })),
      holds: ((data.holds as Record<string, unknown>[]) ?? []).map((hold) => ({
        id: String(hold.id),
        reason: String(hold.reason),
        note: hold.note as string | undefined,
        createdAt: String(hold.created_at ?? hold.createdAt ?? "")
      })),
      minimumPayout: Number(data.minimumPayout ?? 25)
    };
  });
}

export function useStudioModeration() {
  return useStudioResource<StudioModeration>("/creators/me/moderation", studioDefaults().moderation, (raw) => {
    const data = raw as { warnings: number; cases: Record<string, unknown>[] };
    return {
      warnings: data.warnings,
      cases: data.cases.map((item) => ({
        id: String(item.id),
        targetType: String(item.target_type ?? item.targetType ?? ""),
        targetId: String(item.target_id ?? item.targetId ?? ""),
        reason: String(item.reason),
        status: String(item.status),
        resolvedAction: (item.resolved_action ?? item.resolvedAction) as string | undefined,
        createdAt: String(item.created_at ?? item.createdAt ?? "")
      }))
    };
  });
}
