import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../src/components/Avatar";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { useSocial } from "../src/features/social/SocialContext";
import { colors, spacing } from "../src/design/theme";
import { isApiConfigured } from "../src/services/api/client";
import { fetchFollowing, type FollowedCreator } from "../src/services/data/collectionsData";

export default function FollowingList() {
  const router = useRouter();
  const social = useSocial();
  const [items, setItems] = useState<FollowedCreator[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFollowing()
      .then((creators) => {
        if (active) setItems(creators);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your following list");
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
      <Text style={styles.title}>Following</Text>
      {!isApiConfigured() ? (
        <Text style={styles.note}>Your following list syncs when the app is connected to the Vuqiro API.</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items === null ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
      {items !== null && items.length === 0 && !error ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Not following anyone yet</Text>
          <Text style={styles.note}>Find creators on the Discover tab.</Text>
          <Button label="Open Discover" onPress={() => router.push("/(tabs)/discover")} />
        </Card>
      ) : null}
      {(items ?? []).map((creator) => {
        const following = social.isFollowing(creator.creatorId);
        return (
          <Pressable key={creator.creatorId} onPress={() => router.push(`/creator/${creator.creatorId}`)}>
            <Card style={styles.row}>
              <Avatar name={creator.displayName} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {creator.displayName} {creator.isVerified ? "✓" : ""}
                </Text>
                <Text style={styles.meta}>
                  @{creator.handle} • {creator.followerCount.toLocaleString()} followers
                </Text>
              </View>
              <Pressable style={styles.chip} onPress={() => social.toggleFollow(creator.creatorId)}>
                <Text style={styles.chipText}>{following ? "Following" : "Follow"}</Text>
              </Pressable>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginBottom: spacing.lg },
  note: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  emptyCard: { alignItems: "center", gap: spacing.sm, padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  name: { color: colors.text, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.secondary
  },
  chipText: { color: colors.secondary, fontWeight: "900", fontSize: 12 }
});
