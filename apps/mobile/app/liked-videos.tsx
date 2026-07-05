import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { colors, spacing } from "../src/design/theme";
import { isApiConfigured } from "../src/services/api/client";
import { fetchLikedVideos, type CollectionVideo } from "../src/services/data/collectionsData";

export default function LikedVideos() {
  const router = useRouter();
  const [items, setItems] = useState<CollectionVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchLikedVideos()
      .then((videos) => {
        if (active) setItems(videos);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load liked videos");
          setItems([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start" }} />
      <Text style={styles.title}>Liked videos</Text>
      <Text style={styles.note}>Only you can see this list.</Text>
      {!isApiConfigured() ? (
        <Text style={styles.note}>Liked videos sync when the app is connected to the Vuqiro API.</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items === null ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
      {items !== null && items.length === 0 && !error ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No likes yet</Text>
          <Text style={styles.note}>Videos you like will show up here.</Text>
        </Card>
      ) : null}
      {(items ?? []).map((video) => (
        <Pressable key={video.id} onPress={() => router.push(`/video/${video.id}`)}>
          <Card style={styles.row}>
            {video.thumbnailUrl ? (
              <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.caption} numberOfLines={2}>
                {video.caption}
              </Text>
              <Text style={styles.meta}>
                @{video.creatorHandle} • {video.likeCount.toLocaleString()} likes
              </Text>
            </View>
            {video.isPremium ? <Badge label="Locked" tone="warning" /> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  note: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  emptyCard: { alignItems: "center", gap: spacing.sm, padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  thumb: { width: 52, height: 66, borderRadius: 14, backgroundColor: colors.primarySoft },
  caption: { color: colors.text, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 }
});
