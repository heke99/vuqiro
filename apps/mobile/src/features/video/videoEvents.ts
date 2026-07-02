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
