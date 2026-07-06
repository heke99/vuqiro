import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Creator, Video } from "@vuqiro/types";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, gradients, spacing } from "../../design/theme";
import { isApiConfigured } from "../../services/api/client";
import { fetchCreatorProfile } from "../../services/data/creatorData";
import { openConversation } from "../../services/data/messagesData";
import { useSocial } from "../social/SocialContext";

export function CreatorProfileScreen({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const social = useSocial();
  const [data, setData] = useState<{ creator: Creator; videos: Video[] } | null | undefined>(undefined);
  const [messageState, setMessageState] = useState<"idle" | "busy">("idle");
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCreatorProfile(creatorId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [creatorId]);

  if (data === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (data === null) {
    return (
      <Screen>
        <Button
          label="Back"
          variant="ghost"
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start", marginBottom: spacing.md }}
        />
        <Card style={{ alignItems: "center", gap: spacing.sm, padding: spacing.xl }}>
          <Text style={styles.name}>Creator not found</Text>
          <Text style={styles.bio}>This profile may have been removed or is not available right now.</Text>
        </Card>
      </Screen>
    );
  }

  const { creator, videos } = data;
  const following = social.isFollowing(creator.id);
  const blocked = social.isBlocked(creator.id);
  const onSubscribe = () =>
    router.push({ pathname: "/modals/subscribe", params: { creatorId: creator.id } });
  const onCoins = () => router.push({ pathname: "/modals/coins", params: { creatorId: creator.id } });

  const onMessage = async () => {
    if (!isApiConfigured()) {
      setMessageError("Direct messages activate when the app is connected to the Vuqiro API.");
      return;
    }
    setMessageState("busy");
    setMessageError(null);
    try {
      const conversationId = await openConversation({ creatorId: creator.id });
      setMessageState("idle");
      router.push({
        pathname: "/messages/[id]",
        params: { id: conversationId, name: creator.displayName }
      });
    } catch (openError) {
      setMessageState("idle");
      setMessageError(openError instanceof Error ? openError.message : "Could not open the conversation");
    }
  };

  if (blocked) {
    return (
      <Screen>
        <Button
          label="Back"
          variant="ghost"
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start", marginBottom: spacing.md }}
        />
        <Card style={{ alignItems: "center", gap: spacing.sm, padding: spacing.xl }}>
          <Text style={styles.name}>@{creator.handle} is blocked</Text>
          <Text style={styles.bio}>
            You won&apos;t see their videos or comments, and they can&apos;t interact with you.
          </Text>
          <Button label="Unblock" variant="ghost" onPress={() => social.toggleBlock(creator.id)} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topRow}>
        <Button
          label="Back"
          variant="ghost"
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start" }}
        />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button label="Block" variant="ghost" onPress={() => social.toggleBlock(creator.id)} />
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
        <Button
          label={following ? "Following" : "Follow"}
          variant={following ? "ghost" : "secondary"}
          onPress={() => social.toggleFollow(creator.id)}
          style={{ flex: 1 }}
        />
        <Button label="Subscribe" onPress={onSubscribe} style={{ flex: 1 }} />
        <Button label="Send coins" variant="ghost" onPress={onCoins} style={{ flex: 1 }} />
      </View>
      <View style={styles.actions}>
        <Button
          label={messageState === "busy" ? "Opening…" : "Message"}
          variant="ghost"
          onPress={onMessage}
          style={{ flex: 1 }}
        />
      </View>
      {messageError ? <Text style={styles.messageError}>{messageError}</Text> : null}
      <View style={styles.tabs}>
        <Badge label="Videos" />
        <Badge label="Premium" tone="secondary" />
        <Badge label="About" />
      </View>
      {videos.length === 0 ? (
        <Card style={{ alignItems: "center", padding: spacing.xl }}>
          <Text style={styles.videoMeta}>No videos yet.</Text>
        </Card>
      ) : null}
      {videos.map((video) => (
        <Pressable key={video.id} onPress={() => router.push(`/video/${video.id}`)}>
          <Card style={styles.videoRow}>
            {video.thumbnailUrl ? (
              <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.videoTitle}>{video.caption}</Text>
              <Text style={styles.videoMeta}>{video.watchCount.toLocaleString()} views • {video.visibility.replaceAll("_", " ")}</Text>
            </View>
            {video.isPremium ? <Badge label="Locked" tone="warning" /> : <Badge label="Open" tone="secondary" />}
          </Card>
        </Pressable>
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
  videoMeta: { color: colors.textMuted, fontSize: 12 },
  messageError: { color: colors.warning, fontSize: 12, marginBottom: spacing.md, textAlign: "center" }
});
