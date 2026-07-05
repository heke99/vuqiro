import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ViewToken } from "react-native";
import { mockCreators } from "@vuqiro/mock-data";
import { colors, spacing } from "../../design/theme";
import { isDemoContentAllowed } from "../../services/data/demoMode";
import { mockFeedEntries, useFeed, type FeedEntry } from "../../services/data/feedData";
import {
  computeWatchOutcome,
  endFeedSession,
  startFeedSession,
  trackFeedImpression
} from "../../services/data/feedTracking";
import { useSocial } from "../social/SocialContext";
import { trackEvent } from "../video/videoEvents";
import { FeedItem } from "./FeedItem";
import { SponsoredAdCard } from "./SponsoredAdCard";

type FeedTab = "for_you" | "following";

function entryKey(entry: FeedEntry, index: number): string {
  return entry.kind === "ad" ? `ad_${entry.ad.creativeId}_${index}` : entry.video.id;
}

export function FeedScreen() {
  const { height } = useWindowDimensions();
  const social = useSocial();
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedTab, setFeedTab] = useState<FeedTab>("for_you");
  const [muted, setMuted] = useState(false);
  const liveFeed = useFeed(feedTab);

  // Accurate watch accounting: one open "watch" per active video, finalized
  // when the viewer moves on (watchedMs, completion, quick-skip signals).
  const watchRef = useRef<{ videoId: string; index: number; startedAt: number; completed: boolean } | null>(null);

  const finalizeWatch = useCallback(() => {
    const watch = watchRef.current;
    if (!watch) return;
    watchRef.current = null;
    const watchedMs = Date.now() - watch.startedAt;
    const { skippedQuickly } = computeWatchOutcome(watchedMs, watch.completed);
    if (skippedQuickly) {
      trackEvent("video_skip", { videoId: watch.videoId, value: watchedMs / 1000 });
    } else {
      trackEvent("video_qualified_view", { videoId: watch.videoId, value: watchedMs / 1000 });
    }
    trackFeedImpression({
      videoId: watch.videoId,
      position: watch.index,
      watchedMs,
      completed: watch.completed,
      skippedQuickly,
      source: "feed"
    });
  }, []);

  const beginWatch = useCallback((videoId: string, index: number) => {
    watchRef.current = { videoId, index, startedAt: Date.now(), completed: false };
  }, []);

  const markWatchCompleted = useCallback((videoId: string) => {
    if (watchRef.current?.videoId === videoId) {
      watchRef.current.completed = true;
    }
  }, []);

  useEffect(() => {
    trackEvent("feed_view");
    void startFeedSession(feedTab);
    return () => {
      finalizeWatch();
      void endFeedSession(0);
    };
  }, [feedTab, finalizeWatch]);

  const data: FeedEntry[] = useMemo(() => {
    // Live entries when the API is reachable; demo entries only outside production.
    const source =
      liveFeed.isLive || liveFeed.entries.length > 0
        ? liveFeed.entries
        : isDemoContentAllowed()
          ? mockFeedEntries()
          : [];
    // Blocked/muted creators and not-interested videos are hidden. Ads pass through.
    const visible = source.filter(
      (entry) =>
        entry.kind === "ad" ||
        (!social.isBlocked(entry.video.creatorId) &&
          !social.isMuted(entry.video.creatorId) &&
          !social.isNotInterested(entry.video.id))
    );
    if (feedTab === "following" && !liveFeed.isLive) {
      const followed = visible.filter(
        (entry) => entry.kind === "video" && social.isFollowing(entry.video.creatorId)
      );
      if (followed.length > 0) return followed;
      // Cold-start fallback until the user follows someone: verified creators.
      return visible.filter((entry) => {
        if (entry.kind === "ad") return false;
        const creator = mockCreators.find((candidate) => candidate.id === entry.video.creatorId);
        return creator?.isVerified;
      });
    }
    return visible;
  }, [feedTab, social, liveFeed.isLive, liveFeed.entries]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = viewableItems.find((token) => token.isViewable);
    if (visible && typeof visible.index === "number") {
      setActiveIndex(visible.index);
      const item = visible.item as FeedEntry;
      if (watchRef.current?.videoId !== (item.kind === "video" ? item.video.id : undefined)) {
        finalizeWatch();
      }
      if (item.kind === "video" && watchRef.current === null) {
        trackEvent("video_impression", { videoId: item.video.id, creatorId: item.video.creatorId });
        beginWatch(item.video.id, visible.index);
      }
      // Ad impressions are billed server-side and sent by SponsoredAdCard.
    }
  });

  const renderItem = useCallback(
    ({ item, index }: { item: FeedEntry; index: number }) => {
      if (item.kind === "ad") {
        return <SponsoredAdCard ad={item.ad} height={height} isActive={index === activeIndex} />;
      }
      return (
        <FeedItem
          video={item.video}
          creator={item.creator}
          height={height}
          isActive={index === activeIndex}
          muted={muted}
          onToggleMute={() => setMuted((value) => !value)}
          onWatchComplete={() => markWatchCompleted(item.video.id)}
        />
      );
    },
    [height, activeIndex, muted, markWatchCompleted]
  );

  const isEmpty = data.length === 0 && !liveFeed.loading;

  return (
    <View style={{ flex: 1 }}>
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{feedTab === "following" ? "Nothing here yet" : "The feed is empty"}</Text>
          <Text style={styles.emptyCopy}>
            {feedTab === "following"
              ? "Follow creators to fill your Following feed."
              : "Pull to refresh or check back soon."}
          </Text>
          <Pressable style={styles.retryButton} onPress={liveFeed.reload}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={entryKey}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onEndReached={liveFeed.hasMore ? liveFeed.loadMore : undefined}
          onEndReachedThreshold={2}
          ListFooterComponent={
            liveFeed.loading ? (
              <View style={[styles.loadingFooter, { height: 80 }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
      <View style={styles.feedHeader}>
        <View style={styles.feedTabs}>
          <Pressable onPress={() => setFeedTab("following")}>
            <Text style={[styles.feedTabText, feedTab === "following" && styles.feedTabActive]}>Following</Text>
          </Pressable>
          <Pressable onPress={() => setFeedTab("for_you")}>
            <Text style={[styles.feedTabText, feedTab === "for_you" && styles.feedTabActive]}>For You</Text>
          </Pressable>
        </View>
        <Text style={styles.feedHeaderSub}>
          {Math.min(activeIndex + 1, data.length)}/{data.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feedHeader: { position: "absolute", top: 54, left: 0, right: 0, alignItems: "center", gap: 2 },
  feedTabs: { flexDirection: "row", gap: spacing.lg },
  feedTabText: { color: colors.textMuted, fontSize: 16, fontWeight: "800" },
  feedTabActive: { color: colors.text },
  feedHeaderSub: { color: colors.textMuted, fontSize: 11 },
  loadingFooter: { alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  emptyCopy: { color: colors.textMuted, textAlign: "center" },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  retryText: { color: colors.text, fontWeight: "900" }
});
