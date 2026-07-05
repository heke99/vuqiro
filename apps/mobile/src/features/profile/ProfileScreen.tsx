import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../../design/theme";
import { apiFetch, isApiConfigured } from "../../services/api/client";

type MeStats = {
  followerCount: number;
  followingCount: number;
  videoCount: number;
  likeCount: number;
};

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

export function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [stats, setStats] = useState<MeStats | null>(null);

  const displayName = auth.profile?.displayName ?? "Your profile";
  const handle = auth.profile?.handle ?? "vuqiro_user";

  const loadStats = useCallback(async () => {
    if (!isApiConfigured()) {
      setStats({ followerCount: 0, followingCount: 0, videoCount: 0, likeCount: 0 });
      return;
    }
    try {
      const response = await apiFetch<{ profile: MeStats }>("/me");
      setStats({
        followerCount: response.profile.followerCount ?? 0,
        followingCount: response.profile.followingCount ?? 0,
        videoCount: response.profile.videoCount ?? 0,
        likeCount: response.profile.likeCount ?? 0
      });
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar name={displayName} size={74} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.handle}>@{handle}</Text>
        </View>
        <Button label="Settings" variant="ghost" onPress={() => router.push("/settings")} />
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{stats ? formatCount(stats.followerCount) : "—"}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{stats ? formatCount(stats.followingCount) : "—"}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{stats ? formatCount(stats.videoCount) : "—"}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{stats ? formatCount(stats.likeCount) : "—"}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Your collections</Text>
      <Card style={{ gap: spacing.sm }}>
        <Button label="Saved videos" variant="ghost" onPress={() => router.push("/saved-videos")} />
        <Button label="Liked videos" variant="ghost" onPress={() => router.push("/liked-videos")} />
        <Button label="Following" variant="ghost" onPress={() => router.push("/following-list")} />
      </Card>

      <Text style={styles.sectionTitle}>Creator studio</Text>
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.copy}>
          Manage your videos, subscribers, revenue, payouts and moderation standing.
        </Text>
        <Button label="Open creator studio" onPress={() => router.push("/studio")} />
      </Card>

      <Text style={styles.sectionTitle}>Profile</Text>
      <Card style={{ gap: spacing.sm }}>
        <Button label="Edit profile" variant="ghost" onPress={() => router.push("/edit-profile")} />
        <Button label="Wallet" variant="ghost" onPress={() => router.push("/(tabs)/wallet")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  name: { color: colors.text, fontSize: 24, fontWeight: "900" },
  handle: { color: colors.textMuted },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: spacing.xl, marginBottom: spacing.md },
  copy: { color: colors.textSoft, lineHeight: 20 }
});
