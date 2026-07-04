import { apiFetch, isApiConfigured } from "../api/client";

/**
 * Feed session + impression tracking. Impressions buffer locally and flush
 * in batches so the feed never blocks on analytics.
 */

let currentSessionId: string | null = null;

type ImpressionPayload = {
  sessionId?: string;
  videoId?: string;
  adCreativeId?: string;
  position?: number;
  watchedMs?: number;
  completed?: boolean;
  liked?: boolean;
  skippedQuickly?: boolean;
  source?: string;
};

const buffer: ImpressionPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export async function startFeedSession(feedType: "for_you" | "following"): Promise<void> {
  if (!isApiConfigured()) return;
  try {
    const response = await apiFetch<{ sessionId: string }>("/feed/session/start", {
      method: "POST",
      body: JSON.stringify({ feedType })
    });
    currentSessionId = response.sessionId;
  } catch {
    currentSessionId = null;
  }
}

export async function endFeedSession(itemCount: number): Promise<void> {
  if (!isApiConfigured() || !currentSessionId) return;
  const sessionId = currentSessionId;
  currentSessionId = null;
  try {
    await apiFetch("/feed/session/end", {
      method: "POST",
      body: JSON.stringify({ sessionId, itemCount })
    });
  } catch {
    // analytics must never break the feed
  }
}

async function flush(): Promise<void> {
  if (!isApiConfigured() || buffer.length === 0) return;
  const batch = buffer.splice(0, 50);
  try {
    await apiFetch("/feed/impression", {
      method: "POST",
      body: JSON.stringify({ impressions: batch })
    });
  } catch {
    // drop on failure — impressions are best-effort
  }
}

export function trackFeedImpression(payload: ImpressionPayload): void {
  buffer.push({ ...payload, sessionId: currentSessionId ?? undefined });
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, 4000);
  }
}

/** Ad delivery events are billed server-side, so they post immediately. */
export async function trackAdImpression(creativeId: string): Promise<void> {
  if (!isApiConfigured()) return;
  try {
    await apiFetch("/ads/impression", {
      method: "POST",
      body: JSON.stringify({ creativeId, placement: "feed" })
    });
  } catch {
    // best-effort
  }
}

export async function trackAdClick(creativeId: string): Promise<void> {
  if (!isApiConfigured()) return;
  try {
    await apiFetch("/ads/click", {
      method: "POST",
      body: JSON.stringify({ creativeId, placement: "feed" })
    });
  } catch {
    // best-effort
  }
}
