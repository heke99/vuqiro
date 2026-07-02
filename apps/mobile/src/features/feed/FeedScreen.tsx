import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Creator, Video } from "@vuqiro/types";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { VideoActionButton } from "../../components/VideoActionButton";
import { colors, spacing } from "../../design/theme";

function VideoCard({ video, creator, height, onCreator, onSubscribe, onCoins, onReport }: { video: Video; creator: Creator; height: number; onCreator: (creatorId: string) => void; onSubscribe: (creatorId: string) => void; onCoins: () => void; onReport: () => void }) {
  return (
    <View style={[styles.videoCard, { height }]}>
      <LinearGradient colors={["#111827", creator.bannerTone === "cyan" ? "#0E7490" : creator.bannerTone === "emerald" ? "#065F46" : "#4C1D95", "#050507"]} style={StyleSheet.absoluteFill} />
      <View style={styles.videoMock}>
        <Text style={styles.videoMockText}>Vuqiro Preview</Text>
        {video.isPremium ? <Badge label={video.visibility === "unlock_with_coins" ? `${video.coinUnlockPrice} coins` : "Premium"} /> : <Badge label="Public" tone="secondary" />}
      </View>
      <View style={styles.actionRail}>
        <VideoActionButton icon="heart" label={`${Math.round(video.likeCount / 1000)}k`} />
        <VideoActionButton icon="chatbubble" label={`${video.commentCount}`} />
        <VideoActionButton icon="bookmark" label="Save" />
        <VideoActionButton icon="arrow-redo" label="Share" />
        <VideoActionButton icon="flag" label="Report" onPress={onReport} />
      </View>
      <View style={styles.meta}>
        <Pressable style={styles.creatorRow} onPress={() => onCreator(creator.id)}>
          <Avatar name={creator.displayName} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={styles.creatorName}>{creator.displayName} {creator.isVerified ? "✓" : ""}</Text>
            <Text style={styles.handle}>@{creator.handle}</Text>
          </View>
        </Pressable>
        <Text style={styles.caption}>{video.caption}</Text>
        <Text style={styles.hashtags}>{video.hashtags.map((tag) => `#${tag}`).join("  ")}</Text>
        <View style={styles.ctaRow}>
          <Button label="Subscribe" onPress={() => onSubscribe(creator.id)} style={{ flex: 1 }} />
          <Button label="Send coins" variant="ghost" onPress={onCoins} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

export function FeedScreen({ onCreator, onSubscribe, onCoins, onReport }: { onCreator: (creatorId: string) => void; onSubscribe: (creatorId: string) => void; onCoins: () => void; onReport: () => void }) {
  const { height } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const data = useMemo(() => mockVideos, []);
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={(event) => setActive(Math.round(event.nativeEvent.contentOffset.y / height))}
      renderItem={({ item }) => {
        const creator = mockCreators.find((candidate) => candidate.id === item.creatorId) ?? mockCreators[0];
        return <VideoCard video={item} creator={creator} height={height} onCreator={onCreator} onSubscribe={onSubscribe} onCoins={onCoins} onReport={onReport} />;
      }}
      ListHeaderComponent={<View style={styles.feedHeader}><Text style={styles.feedHeaderText}>For You</Text><Text style={styles.feedHeaderSub}>Original Vuqiro feed • {active + 1}/{data.length}</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  videoCard: { width: "100%", backgroundColor: colors.background, justifyContent: "flex-end" },
  videoMock: { position: "absolute", top: 110, left: spacing.lg, gap: spacing.md },
  videoMockText: { color: "rgba(255,255,255,0.78)", fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  actionRail: { position: "absolute", right: spacing.md, bottom: 190, gap: spacing.md },
  meta: { padding: spacing.lg, paddingRight: 86, paddingBottom: 98, gap: spacing.sm },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  creatorName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  handle: { color: colors.textMuted, fontSize: 12 },
  caption: { color: colors.text, fontSize: 16, lineHeight: 22 },
  hashtags: { color: colors.secondary, fontWeight: "800" },
  ctaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  feedHeader: { position: "absolute", top: 48, left: 0, right: 0, zIndex: 10, alignItems: "center" },
  feedHeaderText: { color: colors.text, fontSize: 17, fontWeight: "900" },
  feedHeaderSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 }
});
