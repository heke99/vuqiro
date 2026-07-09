import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ViewToken } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { FeedItem } from "../../src/features/feed/FeedItem";
import { trackEvent } from "../../src/features/video/videoEvents";
import { colors, spacing } from "../../src/design/theme";
import { isDemoMode } from "../../src/services/data/demoMode";
import { fetchVideoFeed, type FeedEntry } from "../../src/services/data/feedData";

/** Full-screen vertical feed for one hashtag. */
export default function HashtagFeed() {
  const { tag } = useLocalSearchParams<{ tag?: string }>();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedTag = (tag ?? "").toLowerCase().replace(/^#/, "");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        if (isDemoMode()) {
          // Mirrors the API's anonymous rules: hashtag pages show public
          // videos only.
          const demoEntries: FeedEntry[] = mockVideos
            .filter((video) => video.visibility === "public" && video.hashtags.includes(normalizedTag))
            .map((video) => ({
              kind: "video",
              video,
              creator: mockCreators.find((candidate) => candidate.id === video.creatorId) ?? mockCreators[0]
            }));
          if (active) setEntries(demoEntries);
        } else {
          const feed = await fetchVideoFeed(`/feed/hashtag/${encodeURIComponent(normalizedTag)}`);
          if (active) setEntries(feed.entries);
        }
      } catch {
        if (active) setEntries([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [normalizedTag]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = viewableItems.find((token) => token.isViewable);
    if (visible && typeof visible.index === "number") {
      setActiveIndex(visible.index);
      const item = visible.item as FeedEntry;
      if (item.kind === "video") {
        trackEvent("video_impression", { videoId: item.video.id, creatorId: item.video.creatorId });
      }
    }
  });

  const renderItem = useCallback(
    ({ item, index }: { item: FeedEntry; index: number }) => {
      if (item.kind !== "video") return null;
      return (
        <FeedItem
          video={item.video}
          creator={item.creator}
          height={height}
          isActive={index === activeIndex}
          muted={muted}
          onToggleMute={() => setMuted((value) => !value)}
        />
      );
    },
    [height, activeIndex, muted]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>#{normalizedTag}</Text>
          <Text style={styles.emptyCopy}>No videos with this hashtag yet.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => (entry.kind === "video" ? entry.video.id : "ad")}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        />
      )}
      <View style={styles.header}>
        <Pressable style={styles.backChip} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>#{normalizedTag}</Text>
        <View style={{ width: 68 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  emptyCopy: { color: colors.textMuted, textAlign: "center" },
  header: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md
  },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  backChip: {
    backgroundColor: "rgba(10,10,14,0.55)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    width: 68,
    alignItems: "center"
  },
  backText: { color: colors.text, fontWeight: "900" }
});
