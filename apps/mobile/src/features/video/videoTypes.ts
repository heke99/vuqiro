export type VideoPlaybackState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";

export type VideoPlayerProps = {
  playbackUrl?: string;
  thumbnailUrl?: string;
  isActive?: boolean;
  muted?: boolean;
  loop?: boolean;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
  onError?: (message: string) => void;
};

/**
 * All content states a feed item can be in. Anything except "public" and
 * "premium" changes what the viewer sees; the server is the authority for
 * whether locked/premium content may actually play.
 */
export type FeedItemState =
  | "public"
  | "premium"
  | "subscriber_only"
  | "unlock_with_coins"
  | "under_review"
  | "removed"
  | "blocked"
  | "age_restricted";
