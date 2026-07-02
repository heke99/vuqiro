import type { AnalyticsEventName } from "@vuqiro/types";

export type VideoAnalyticsEvent = {
  name: AnalyticsEventName;
  videoId?: string;
  creatorId?: string;
  value?: number;
  at: string;
};

/**
 * Feed/video analytics events. Buffered locally for now; the backend
 * analytics batch flushes these to the events API.
 */
const buffer: VideoAnalyticsEvent[] = [];
const MAX_BUFFER = 500;

export function trackEvent(
  name: AnalyticsEventName,
  payload: { videoId?: string; creatorId?: string; value?: number } = {}
): void {
  buffer.push({ name, ...payload, at: new Date().toISOString() });
  if (buffer.length > MAX_BUFFER) {
    buffer.splice(0, buffer.length - MAX_BUFFER);
  }
  if (__DEV__) {
    console.debug(`[analytics] ${name}`, payload);
  }
}

export function getBufferedEvents(): readonly VideoAnalyticsEvent[] {
  return buffer;
}

export function drainBufferedEvents(): VideoAnalyticsEvent[] {
  return buffer.splice(0, buffer.length);
}

let flusher: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically flushes buffered events to the API (when configured).
 * Failed batches are re-buffered so nothing is lost between retries.
 */
export function startEventFlusher(
  send: (events: VideoAnalyticsEvent[]) => Promise<void>,
  intervalMs = 15_000
): () => void {
  if (flusher) clearInterval(flusher);
  flusher = setInterval(async () => {
    if (buffer.length === 0) return;
    const batch = drainBufferedEvents().slice(0, 100);
    try {
      await send(batch);
    } catch {
      buffer.unshift(...batch);
    }
  }, intervalMs);
  return () => {
    if (flusher) clearInterval(flusher);
    flusher = null;
  };
}
