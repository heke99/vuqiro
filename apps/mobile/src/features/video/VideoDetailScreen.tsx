import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { mockComments, mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Comment, Video } from "@vuqiro/types";
import { VideoPlayer } from "./VideoPlayer";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { useSocial } from "../social/SocialContext";
import { colors, spacing } from "../../design/theme";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { isDemoContentAllowed } from "../../services/data/demoMode";
import { dtoToEntry, type FeedItemDto } from "../../services/data/feedData";

type DetailData = {
  video: Video;
  creator: { id: string; handle: string; displayName: string; isVerified: boolean };
  comments: Comment[];
};

function demoDetail(videoId: string): DetailData | null {
  const video = mockVideos.find((item) => item.id === videoId) ?? mockVideos[0];
  const creator = mockCreators.find((item) => item.id === video.creatorId) ?? mockCreators[0];
  return {
    video,
    creator,
    comments: mockComments.filter((comment) => comment.videoId === video.id && !comment.parentCommentId)
  };
}

async function loadDetail(videoId: string): Promise<DetailData | null> {
  if (!isApiConfigured()) {
    return isDemoContentAllowed() ? demoDetail(videoId) : null;
  }
  try {
    const [videoResponse, commentsResponse] = await Promise.all([
      apiFetch<{ video: FeedItemDto | Video }>(`/videos/${videoId}`),
      apiFetch<{ comments: { id: string; author_id?: string; text?: string; profiles?: { display_name?: string } }[] }>(
        `/videos/${videoId}/comments?limit=3`
      )
    ]);
    const raw = videoResponse.video;
    const video = "creatorHandle" in raw ? dtoToEntry(raw as FeedItemDto).video : (raw as Video);
    const dto = raw as FeedItemDto;
    const creator = {
      id: video.creatorId,
      handle: dto.creatorHandle ?? "unknown",
      displayName: dto.creatorDisplayName ?? "Creator",
      isVerified: dto.creatorVerified ?? false
    };
    const comments: Comment[] = commentsResponse.comments.slice(0, 3).map((row) => ({
      id: row.id,
      videoId,
      authorId: row.author_id ?? "",
      authorHandle: "",
      authorDisplayName: row.profiles?.display_name ?? "User",
      isCreator: false,
      isSubscriber: false,
      text: row.text ?? "",
      likeCount: 0,
      replyCount: 0,
      createdAt: ""
    }));
    return { video, creator, comments };
  } catch {
    return isDemoContentAllowed() ? demoDetail(videoId) : null;
  }
}

export function VideoDetailScreen({ videoId }: { videoId: string }) {
  const router = useRouter();
  const social = useSocial();
  const [data, setData] = useState<DetailData | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void loadDetail(videoId).then((detail) => {
      if (active) setData(detail);
    });
    return () => {
      active = false;
    };
  }, [videoId]);

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
        <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start" }} />
        <Card style={{ alignItems: "center", gap: spacing.sm, padding: spacing.xl, marginTop: spacing.lg }}>
          <Text style={styles.lockedTitle}>Video unavailable</Text>
          <Text style={styles.lockedSub}>This video may have been removed or is not available right now.</Text>
        </Card>
      </Screen>
    );
  }

  const { video, creator, comments } = data;
  const liked = social.isLiked(video.id);
  const saved = social.isSaved(video.id);
  const isLocked = video.visibility === "unlock_with_coins" || video.visibility === "subscribers_only";

  return (
    <Screen>
      <View style={styles.topRow}>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
        <Button
          label="Report"
          variant="ghost"
          onPress={() =>
            router.push({ pathname: "/modals/report", params: { targetType: "video", targetId: video.id } })
          }
        />
      </View>
      <View style={styles.player}>
        <VideoPlayer playbackUrl={isLocked ? undefined : video.playbackUrl} isActive={!isLocked} loop />
        {isLocked ? (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockedTitle}>Locked content</Text>
            <Text style={styles.lockedSub}>
              {video.visibility === "unlock_with_coins"
                ? `Unlock for ${video.coinUnlockPrice} coins`
                : "Available to subscribers"}
            </Text>
            <Button
              label={video.visibility === "unlock_with_coins" ? "Unlock video" : "See subscription options"}
              onPress={() =>
                router.push({ pathname: "/modals/locked-content", params: { videoId: video.id } })
              }
            />
          </View>
        ) : null}
      </View>
      <Pressable style={styles.creatorRow} onPress={() => router.push(`/creator/${creator.id}`)}>
        <Avatar name={creator.displayName} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.creatorName}>
            {creator.displayName} {creator.isVerified ? "✓" : ""}
          </Text>
          <Text style={styles.creatorMeta}>@{creator.handle}</Text>
        </View>
        <Button
          label="Subscribe"
          onPress={() =>
            router.push({ pathname: "/modals/subscribe", params: { creatorId: creator.id } })
          }
        />
      </Pressable>
      <Text style={styles.caption}>{video.caption}</Text>
      <Text style={styles.hashtags}>{video.hashtags.map((tag) => `#${tag}`).join("  ")}</Text>
      <View style={styles.statRow}>
        <Badge label={`${video.likeCount.toLocaleString()} likes`} />
        <Badge label={`${video.watchCount.toLocaleString()} views`} tone="secondary" />
        <Badge label={`${video.shareCount.toLocaleString()} shares`} />
      </View>
      <View style={styles.actionsRow}>
        <Button
          label={liked ? "Liked" : "Like"}
          variant={liked ? "primary" : "ghost"}
          style={{ flex: 1 }}
          onPress={() => social.toggleLike(video.id, creator.id)}
        />
        <Button
          label={saved ? "Saved" : "Save"}
          variant={saved ? "primary" : "ghost"}
          style={{ flex: 1 }}
          onPress={() => social.toggleSave(video.id, creator.id)}
        />
        <Button
          label="Share"
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: "/modals/share-sheet", params: { videoId: video.id } })}
        />
      </View>
      <View style={styles.commentsHeader}>
        <Text style={styles.sectionTitle}>Comments ({video.commentCount})</Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/modals/comment-sheet", params: { videoId: video.id } })
          }
        >
          <Text style={styles.viewAll}>View all</Text>
        </Pressable>
      </View>
      {comments.length === 0 ? <Text style={styles.creatorMeta}>No comments yet.</Text> : null}
      {comments.slice(0, 3).map((comment) => (
        <Card key={comment.id} style={styles.commentRow}>
          <Avatar name={comment.authorDisplayName} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.commentAuthor}>
              {comment.authorDisplayName}
              {comment.isCreator ? "  · Creator" : comment.isSubscriber ? "  · Subscriber" : ""}
            </Text>
            <Text style={styles.commentText}>{comment.text}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  player: {
    height: 340,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg
  },
  lockedOverlay: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
  lockedTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  lockedSub: { color: colors.textSoft, marginBottom: spacing.sm, textAlign: "center" },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  creatorName: { color: colors.text, fontWeight: "900", fontSize: 16 },
  creatorMeta: { color: colors.textMuted, fontSize: 12 },
  caption: { color: colors.text, fontSize: 17, lineHeight: 24 },
  hashtags: { color: colors.secondary, fontWeight: "800", marginTop: 4, marginBottom: spacing.md },
  statRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  commentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md
  },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  viewAll: { color: colors.secondary, fontWeight: "800" },
  commentRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  commentAuthor: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 2 },
  commentText: { color: colors.text, lineHeight: 20 }
});
