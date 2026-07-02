import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, gradients, spacing } from "../../design/theme";

export function CreatorProfileScreen({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const creator = mockCreators.find((item) => item.id === creatorId) ?? mockCreators[0];
  const videos = mockVideos.filter((video) => video.creatorId === creator.id);
  const onSubscribe = () =>
    router.push({ pathname: "/modals/subscribe", params: { creatorId: creator.id } });
  const onCoins = () => router.push({ pathname: "/modals/coins", params: { creatorId: creator.id } });
  return (
    <Screen>
      <View style={styles.topRow}>
        <Button
          label="Back"
          variant="ghost"
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start" }}
        />
        <Button
          label="Report"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/modals/report",
              params: { targetType: "profile", targetId: creator.id }
            })
          }
        />
      </View>
      <LinearGradient colors={gradients[creator.bannerTone]} style={styles.banner}>
        <Avatar name={creator.displayName} size={86} />
        <Text style={styles.name}>{creator.displayName} {creator.isVerified ? "✓" : ""}</Text>
        <Text style={styles.handle}>@{creator.handle}</Text>
        <Text style={styles.bio}>{creator.bio}</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>{creator.followerCount.toLocaleString()} followers</Text>
          <Text style={styles.stat}>{creator.subscriberCount.toLocaleString()} subscribers</Text>
          <Text style={styles.stat}>{creator.totalLikes.toLocaleString()} likes</Text>
        </View>
      </LinearGradient>
      <View style={styles.actions}>
        <Button label="Subscribe" onPress={onSubscribe} style={{ flex: 1 }} />
        <Button label="Support with coins" variant="ghost" onPress={onCoins} style={{ flex: 1 }} />
      </View>
      <View style={styles.tabs}>
        <Badge label="Videos" />
        <Badge label="Premium" tone="secondary" />
        <Badge label="About" />
      </View>
      {videos.map((video) => (
        <Card key={video.id} style={styles.videoRow}>
          <View style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.videoTitle}>{video.caption}</Text>
            <Text style={styles.videoMeta}>{video.watchCount.toLocaleString()} views • {video.visibility.replaceAll("_", " ")}</Text>
          </View>
          {video.isPremium ? <Badge label="Locked" tone="warning" /> : <Badge label="Open" tone="secondary" />}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md
  },
  banner: { borderRadius: 28, padding: spacing.xl, alignItems: "center", gap: spacing.sm, overflow: "hidden" },
  name: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: spacing.sm },
  handle: { color: colors.textMuted },
  bio: { color: colors.textSoft, textAlign: "center", lineHeight: 21, maxWidth: 300 },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.md, marginTop: spacing.md },
  stat: { color: colors.text, fontWeight: "800", fontSize: 12 },
  actions: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.lg },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  videoRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.md },
  thumb: { width: 58, height: 74, borderRadius: 16, backgroundColor: colors.primarySoft },
  videoTitle: { color: colors.text, fontWeight: "800", marginBottom: 4 },
  videoMeta: { color: colors.textMuted, fontSize: 12 }
});
