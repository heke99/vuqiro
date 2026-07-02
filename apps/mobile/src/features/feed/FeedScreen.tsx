import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ViewToken } from "react-native";
import { mockCreators } from "@vuqiro/mock-data";
import { colors, spacing } from "../../design/theme";
import { mockFeedEntries, useFeed, type FeedEntry } from "../../services/data/feedData";
import { useSocial } from "../social/SocialContext";
import { trackEvent } from "../video/videoEvents";
import { FeedItem } from "./FeedItem";

type FeedTab = "for_you" | "following";

export function FeedScreen() {
  const { height } = useWindowDimensions();
  const social = useSocial();
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedTab, setFeedTab] = useState<FeedTab>("for_you");
  const liveFeed = useFeed(feedTab);

  useEffect(() => {
    trackEvent("feed_view");
  }, [feedTab]);

  const data: FeedEntry[] = useMemo(() => {
    // Live entries when the API is reachable, mock entries otherwise.
    const source = liveFeed.isLive ? liveFeed.entries : mockFeedEntries();
    // Blocked creators are always hidden, in every feed.
    const visible = source.filter((entry) => !social.isBlocked(entry.video.creatorId));
    if (feedTab === "following" && !liveFeed.isLive) {
      const followed = visible.filter((entry) => social.isFollowing(entry.video.creatorId));
      if (followed.length > 0) return followed;
      // Cold-start fallback until the user follows someone: verified creators.
      return visible.filter((entry) => {
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
      trackEvent("video_impression", { videoId: item.video.id, creatorId: item.video.creatorId });
    }
  });

  const renderItem = useCallback(
    ({ item, index }: { item: FeedEntry; index: number }) => (
      <FeedItem video={item.video} creator={item.creator} height={height} isActive={index === activeIndex} />
    ),
    [height, activeIndex]
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.video.id}
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
  feedHeaderSub: { color: colors.textMuted, fontSize: 11 }
});
