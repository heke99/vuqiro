import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Creator, Video } from "@vuqiro/types";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { VideoActionButton } from "../../components/VideoActionButton";
import { colors, spacing } from "../../design/theme";
import { useSocial } from "../social/SocialContext";
import { VideoPlayer } from "../video/VideoPlayer";
import { trackEvent } from "../video/videoEvents";
import type { FeedItemState } from "../video/videoTypes";

export function deriveFeedItemState(video: Video): FeedItemState {
  if (video.moderationStatus === "removed") return "removed";
  if (video.moderationStatus === "blocked") return "blocked";
  if (video.moderationStatus === "under_review" || video.status === "under_review") return "under_review";
  if (video.moderationStatus === "age_restricted") return "age_restricted";
  if (video.visibility === "unlock_with_coins") return "unlock_with_coins";
  if (video.visibility === "subscribers_only") return "subscriber_only";
  if (video.visibility === "premium_tier_only" || video.isPremium) return "premium";
  return "public";
}

function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

const DOUBLE_TAP_MS = 260;

export function FeedItem({
  video,
  creator,
  height,
  isActive,
  muted = false,
  onToggleMute,
  onWatchComplete
}: {
  video: Video;
  creator: Creator;
  height: number;
  isActive: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  /** Fires when playback reaches the end (used for accurate watch metrics). */
  onWatchComplete?: () => void;
}) {
  const router = useRouter();
  const social = useSocial();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const lastProgressBucket = useRef(-1);
  const lastTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liked = social.isLiked(video.id);
  const saved = social.isSaved(video.id);
  const following = social.isFollowing(creator.id);

  const state = deriveFeedItemState(video);
  const locked = state === "subscriber_only" || state === "unlock_with_coins" || state === "premium";
  const hidden = state === "removed" || state === "blocked" || state === "under_review";
  const needsAgeGate = state === "age_restricted" && !ageConfirmed;
  const canPlay = isActive && !paused && !locked && !hidden && !needsAgeGate;

  const toggleLike = () => social.toggleLike(video.id, creator.id);
  const toggleSave = () => social.toggleSave(video.id, creator.id);

  // Single tap pauses/plays; double tap likes (with a heart burst).
  const onSurfaceTap = () => {
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      if (!liked) toggleLike();
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 700);
      return;
    }
    lastTapAt.current = now;
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      setPaused((value) => {
        trackEvent(value ? "video_play" : "video_pause", { videoId: video.id });
        return !value;
      });
    }, DOUBLE_TAP_MS);
  };

  return (
    <View style={[styles.container, { height }]}>
      <VideoPlayer
        playbackUrl={locked || hidden ? undefined : video.playbackUrl}
        thumbnailUrl={video.thumbnailUrl}
        isActive={canPlay}
        loop
        muted={muted}
        onProgress={(seconds) => {
          const bucket = Math.floor(seconds / 5);
          if (bucket !== lastProgressBucket.current) {
            lastProgressBucket.current = bucket;
            trackEvent("video_progress", { videoId: video.id, value: seconds });
          }
        }}
        onComplete={() => {
          trackEvent("video_complete", { videoId: video.id });
          onWatchComplete?.();
        }}
        onError={() => trackEvent("video_pause", { videoId: video.id })}
      />

      {!locked && !hidden && !needsAgeGate ? (
        <Pressable style={styles.tapSurface} onPress={onSurfaceTap} />
      ) : null}

      {heartBurst ? (
        <View style={styles.heartBurst} pointerEvents="none">
          <Ionicons name="heart" size={96} color={colors.primary} />
        </View>
      ) : null}

      {paused && !locked && !hidden && !needsAgeGate ? (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Ionicons name="play" size={54} color="rgba(255,255,255,0.85)" />
        </View>
      ) : null}

      {hidden ? (
        <View style={styles.stateOverlay}>
          <Ionicons name="eye-off" size={40} color={colors.textMuted} />
          <Text style={styles.stateTitle}>
            {state === "under_review" ? "Under review" : state === "removed" ? "Removed" : "Unavailable"}
          </Text>
          <Text style={styles.stateCopy}>
            {state === "under_review"
              ? "This video is being reviewed by Vuqiro moderation."
              : "This video is no longer available."}
          </Text>
        </View>
      ) : null}

      {needsAgeGate ? (
        <View style={styles.stateOverlay}>
          <Ionicons name="alert-circle" size={40} color={colors.warning} />
          <Text style={styles.stateTitle}>Age-restricted</Text>
          <Text style={styles.stateCopy}>This video may not be suitable for all audiences.</Text>
          <Button label="I'm 18+, show it" variant="ghost" onPress={() => setAgeConfirmed(true)} />
        </View>
      ) : null}

      {locked ? (
        <Pressable
          style={styles.stateOverlay}
          onPress={() => router.push({ pathname: "/modals/locked-content", params: { videoId: video.id } })}
        >
          <Ionicons name="lock-closed" size={40} color={colors.secondary} />
          <Text style={styles.stateTitle}>
            {state === "unlock_with_coins" ? `Unlock for ${video.coinUnlockPrice} coins` : "Subscribers only"}
          </Text>
          <Text style={styles.stateCopy}>
            {state === "unlock_with_coins"
              ? "Support this creator and watch instantly."
              : `Subscribe to ${creator.displayName} to watch.`}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.actionRail}>
        <VideoActionButton
          icon={liked ? "heart" : "heart-outline"}
          label={formatCount(video.likeCount + (liked ? 1 : 0))}
          onPress={toggleLike}
        />
        <VideoActionButton
          icon="chatbubble"
          label={formatCount(video.commentCount)}
          onPress={() => {
            trackEvent("video_comment_open", { videoId: video.id });
            router.push({ pathname: "/modals/comment-sheet", params: { videoId: video.id } });
          }}
        />
        <VideoActionButton
          icon={saved ? "bookmark" : "bookmark-outline"}
          label={saved ? "Saved" : "Save"}
          onPress={toggleSave}
        />
        <VideoActionButton
          icon="arrow-redo"
          label="Share"
          onPress={() => {
            trackEvent("video_share_open", { videoId: video.id });
            router.push({ pathname: "/modals/share-sheet", params: { videoId: video.id } });
          }}
        />
        <VideoActionButton
          icon={muted ? "volume-mute" : "volume-high"}
          label={muted ? "Muted" : "Sound"}
          onPress={() => onToggleMute?.()}
        />
        <VideoActionButton
          icon="ellipsis-horizontal"
          label="More"
          onPress={() =>
            router.push({
              pathname: "/modals/video-options",
              params: { videoId: video.id, creatorId: creator.id, creatorHandle: creator.handle }
            })
          }
        />
      </View>

      <View style={styles.meta}>
        <Pressable
          style={styles.creatorRow}
          onPress={() => {
            trackEvent("creator_profile_open", { creatorId: creator.id });
            router.push(`/creator/${creator.id}`);
          }}
        >
          <Avatar name={creator.displayName} size={42} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.creatorName}>{creator.displayName}</Text>
              {creator.isVerified ? <Ionicons name="checkmark-circle" size={15} color={colors.secondary} /> : null}
            </View>
            <Text style={styles.handle}>@{creator.handle}</Text>
          </View>
          <Pressable style={[styles.followChip, following && styles.followChipOn]} onPress={() => social.toggleFollow(creator.id)}>
            <Text style={[styles.followChipText, following && styles.followChipTextOn]}>
              {following ? "Following" : "Follow"}
            </Text>
          </Pressable>
        </Pressable>
        <Text style={styles.caption}>{video.caption}</Text>
        <View style={styles.badgeRow}>
          {video.category ? <Badge label={video.category} tone="secondary" /> : null}
          {state === "premium" || video.isPremium ? <Badge label="Premium" /> : null}
          {locked ? <Badge label="Locked" tone="warning" /> : null}
        </View>
        <Text style={styles.hashtags}>{video.hashtags.map((tag) => `#${tag}`).join("  ")}</Text>
        <View style={styles.ctaRow}>
          <Button
            label="Support creator"
            onPress={() => {
              trackEvent("coin_support_open", { creatorId: creator.id });
              router.push({ pathname: "/modals/coins", params: { creatorId: creator.id } });
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Subscribe"
            variant="ghost"
            onPress={() => {
              trackEvent("creator_subscribe_open", { creatorId: creator.id });
              router.push({ pathname: "/modals/subscribe", params: { creatorId: creator.id } });
            }}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", backgroundColor: colors.background, justifyContent: "flex-end", overflow: "hidden" },
  tapSurface: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  heartBurst: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4
  },
  pausedBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  stateOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5,5,8,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    zIndex: 2
  },
  stateTitle: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  stateCopy: { color: colors.textSoft, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  actionRail: { position: "absolute", right: spacing.md, bottom: 210, gap: spacing.md, zIndex: 3 },
  meta: { padding: spacing.lg, paddingRight: 86, paddingBottom: 28, gap: spacing.sm, zIndex: 3 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  creatorName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  handle: { color: colors.textMuted, fontSize: 12 },
  caption: { color: colors.text, fontSize: 16, lineHeight: 22 },
  badgeRow: { flexDirection: "row", gap: spacing.sm },
  hashtags: { color: colors.secondary, fontWeight: "800" },
  ctaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  followChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.secondary
  },
  followChipOn: { backgroundColor: colors.secondarySoft },
  followChipText: { color: colors.secondary, fontWeight: "900", fontSize: 12 },
  followChipTextOn: { color: colors.text }
});
