import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { useStudioVideos } from "../../src/features/studio/studioData";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, spacing } from "../../src/design/theme";

export default function StudioVideos() {
  const router = useRouter();
  const { data: videos, reload } = useStudioVideos();
  const [status, setStatus] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  const removeVideo = async (videoId: string) => {
    setStatus(null);
    if (isApiConfigured()) {
      try {
        await apiFetch(`/videos/${videoId}`, { method: "DELETE" });
        reload();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Delete failed");
        return;
      }
    }
    setDeleted((current) => new Set(current).add(videoId));
    setStatus("Video deleted. It no longer appears anywhere in the app.");
  };

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Your videos</Text>
      <Text style={styles.subtitle}>Upload status, visibility and moderation state for every video.</Text>
      <Button label="Upload new video" onPress={() => router.push("/(tabs)/upload")} style={{ marginBottom: spacing.lg }} />
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {videos
        .filter((video) => !deleted.has(video.id))
        .map((video) => (
          <Card key={video.id} style={styles.videoCard}>
            <Text style={styles.caption}>{video.caption}</Text>
            <View style={styles.badges}>
              <Badge label={video.visibility.replaceAll("_", " ")} tone="secondary" />
              <Badge label={video.status ?? "ready"} />
              {video.moderationStatus && video.moderationStatus !== "visible" ? (
                <Badge label={video.moderationStatus.replaceAll("_", " ")} tone="warning" />
              ) : null}
              {video.reportCount ? <Badge label={`${video.reportCount} reports`} tone="warning" /> : null}
            </View>
            <Text style={styles.meta}>
              {video.watchCount.toLocaleString()} views · {video.likeCount.toLocaleString()} likes
              {video.createdAt ? ` · ${new Date(video.createdAt).toLocaleDateString()}` : ""}
            </Text>
            <View style={styles.actions}>
              {video.moderationStatus === "removed" || video.status === "removed" ? (
                <Button
                  label="Appeal removal"
                  variant="ghost"
                  onPress={() => router.push({ pathname: "/studio/moderation", params: { appealVideoId: video.id } })}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button label="Delete" variant="danger" onPress={() => removeVideo(video.id)} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  status: { color: colors.success, fontWeight: "700", marginBottom: spacing.md },
  videoCard: { gap: spacing.sm, marginBottom: spacing.md },
  caption: { color: colors.text, fontWeight: "800", lineHeight: 20 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: "row", gap: spacing.sm }
});
