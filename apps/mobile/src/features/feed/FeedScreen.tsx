import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ViewToken } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { colors, spacing } from "../../design/theme";
import { trackEvent } from "../video/videoEvents";
import { FeedItem } from "./FeedItem";

type FeedTab = "for_you" | "following";

export function FeedScreen() {
  const { height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedTab, setFeedTab] = useState<FeedTab>("for_you");

  useEffect(() => {
    trackEvent("feed_view");
  }, [feedTab]);

  const data = useMemo(() => {
    if (feedTab === "following") {
      // Mock "Following": videos from verified creators the demo user follows.
      return mockVideos.filter((video) => {
        const creator = mockCreators.find((candidate) => candidate.id === video.creatorId);
        return creator?.isVerified;
      });
    }
    return mockVideos;
  }, [feedTab]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = viewableItems.find((token) => token.isViewable);
    if (visible && typeof visible.index === "number") {
      setActiveIndex(visible.index);
      const item = visible.item as (typeof mockVideos)[number];
      trackEvent("video_impression", { videoId: item.id, creatorId: item.creatorId });
    }
  });

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof mockVideos)[number]; index: number }) => {
      const creator = mockCreators.find((candidate) => candidate.id === item.creatorId) ?? mockCreators[0];
      return <FeedItem video={item} creator={creator} height={height} isActive={index === activeIndex} />;
    },
    [height, activeIndex]
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
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
