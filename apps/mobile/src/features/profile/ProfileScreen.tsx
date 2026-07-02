import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../../design/theme";

export function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const onSettings = () => router.push("/settings");
  const displayName = auth.profile?.displayName ?? "Your profile";
  const handle = auth.profile?.handle ?? "vuqiro_user";
  return (
    <Screen>
      <View style={styles.header}>
        <Avatar name={displayName} size={74} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.handle}>@{handle}</Text>
        </View>
        <Button label="Settings" variant="ghost" onPress={onSettings} />
      </View>
      <View style={styles.stats}>
        <Card style={styles.stat}><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>Videos</Text></Card>
        <Card style={styles.stat}><Text style={styles.statValue}>8</Text><Text style={styles.statLabel}>Subs</Text></Card>
        <Card style={styles.stat}><Text style={styles.statValue}>1.2k</Text><Text style={styles.statLabel}>Coins</Text></Card>
      </View>
      <Text style={styles.sectionTitle}>Creator studio</Text>
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.copy}>
          Manage your videos, subscribers, revenue, payouts and moderation standing.
        </Text>
        <Button label="Open creator studio" onPress={() => router.push("/studio")} />
      </Card>
      <Text style={styles.sectionTitle}>Your access</Text>
      <Card style={{ gap: spacing.sm }}>
        <Badge label="Creator Support active" tone="secondary" />
        <Text style={styles.copy}>Manage creator memberships, locked content, saved videos and wallet activity from here.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  name: { color: colors.text, fontSize: 24, fontWeight: "900" },
  handle: { color: colors.textMuted },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: colors.text, fontSize: 24, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: spacing.xl, marginBottom: spacing.md },
  copy: { color: colors.textSoft, lineHeight: 20 }
});
