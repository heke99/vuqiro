import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Creator, Video } from "@vuqiro/types";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { VideoActionButton } from "../../components/VideoActionButton";
import { colors, spacing } from "../../design/theme";

type FeedTab = "for_you" | "following";

function VideoCard({ video, creator, height }: { video: Video; creator: Creator; height: number }) {
  const router = useRouter();
  const isLocked = video.visibility === "unlock_with_coins" || video.visibility === "subscribers_only";
  return (
    <View style={[styles.videoCard, { height }]}>
      <LinearGradient
        colors={[
          "#111827",
          creator.bannerTone === "cyan" ? "#0E7490" : creator.bannerTone === "emerald" ? "#065F46" : "#4C1D95",
          "#050507"
        ]}
        style={StyleSheet.absoluteFill}
      />
      <Pressable style={styles.videoMock} onPress={() => router.push(`/video/${video.id}`)}>
        <Text style={styles.videoMockText}>Vuqiro Preview</Text>
        {video.isPremium ? (
          <Badge
            label={video.visibility === "unlock_with_coins" ? `${video.coinUnlockPrice} coins` : "Premium"}
          />
        ) : (
          <Badge label="Public" tone="secondary" />
        )}
      </Pressable>
      <View style={styles.actionRail}>
        <VideoActionButton icon="heart" label={`${Math.round(video.likeCount / 1000)}k`} />
        <VideoActionButton
          icon="chatbubble"
          label={`${video.commentCount}`}
          onPress={() => router.push({ pathname: "/modals/comment-sheet", params: { videoId: video.id } })}
        />
        <VideoActionButton icon="bookmark" label="Save" />
        <VideoActionButton
          icon="arrow-redo"
          label="Share"
          onPress={() => router.push({ pathname: "/modals/share-sheet", params: { videoId: video.id } })}
        />
        <VideoActionButton
          icon="flag"
          label="Report"
          onPress={() =>
            router.push({ pathname: "/modals/report", params: { targetType: "video", targetId: video.id } })
          }
        />
      </View>
      <View style={styles.meta}>
        <Pressable style={styles.creatorRow} onPress={() => router.push(`/creator/${creator.id}`)}>
          <Avatar name={creator.displayName} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={styles.creatorName}>
              {creator.displayName} {creator.isVerified ? "✓" : ""}
            </Text>
            <Text style={styles.handle}>@{creator.handle}</Text>
          </View>
        </Pressable>
        <Text style={styles.caption}>{video.caption}</Text>
        <Text style={styles.hashtags}>{video.hashtags.map((tag) => `#${tag}`).join("  ")}</Text>
        <View style={styles.ctaRow}>
          <Button
            label={isLocked ? "Unlock" : "Subscribe"}
            onPress={() =>
              isLocked
                ? router.push({ pathname: "/modals/locked-content", params: { videoId: video.id } })
                : router.push({ pathname: "/modals/subscribe", params: { creatorId: creator.id } })
            }
            style={{ flex: 1 }}
          />
          <Button
            label="Send coins"
            variant="ghost"
            onPress={() => router.push({ pathname: "/modals/coins", params: { creatorId: creator.id } })}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

export function FeedScreen() {
  const { height } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const [feedTab, setFeedTab] = useState<FeedTab>("for_you");
  const data = useMemo(() => {
    if (feedTab === "following") {
      // Mock "Following" feed: videos from verified creators the demo user follows.
      return mockVideos.filter((video) => {
        const creator = mockCreators.find((candidate) => candidate.id === video.creatorId);
        return creator?.isVerified;
      });
    }
    return mockVideos;
  }, [feedTab]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setActive(Math.round(event.nativeEvent.contentOffset.y / height))}
        renderItem={({ item }) => {
          const creator = mockCreators.find((candidate) => candidate.id === item.creatorId) ?? mockCreators[0];
          return <VideoCard video={item} creator={creator} height={height} />;
        }}
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
          {active + 1}/{data.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoCard: { width: "100%", backgroundColor: colors.background, justifyContent: "flex-end" },
  videoMock: { position: "absolute", top: 110, left: spacing.lg, gap: spacing.md },
  videoMockText: { color: "rgba(255,255,255,0.78)", fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  actionRail: { position: "absolute", right: spacing.md, bottom: 190, gap: spacing.md },
  meta: { padding: spacing.lg, paddingRight: 86, paddingBottom: 30, gap: spacing.sm },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  creatorName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  handle: { color: colors.textMuted, fontSize: 12 },
  caption: { color: colors.text, fontSize: 16, lineHeight: 22 },
  hashtags: { color: colors.secondary, fontWeight: "800" },
  ctaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  feedHeader: { position: "absolute", top: 54, left: 0, right: 0, alignItems: "center", gap: 2 },
  feedTabs: { flexDirection: "row", gap: spacing.lg },
  feedTabText: { color: colors.textMuted, fontSize: 16, fontWeight: "800" },
  feedTabActive: { color: colors.text },
  feedHeaderSub: { color: colors.textMuted, fontSize: 11 }
});
