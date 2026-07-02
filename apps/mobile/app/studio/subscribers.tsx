import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { useStudioSubscribers } from "../../src/features/studio/studioData";
import { colors, spacing } from "../../src/design/theme";

export default function StudioSubscribers() {
  const router = useRouter();
  const { data } = useStudioSubscribers();

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Subscribers</Text>
      <Text style={styles.subtitle}>Active memberships across your tiers. No payment details are shown.</Text>
      <View style={styles.grid}>
        <Card style={styles.metric}>
          <Text style={styles.metricValue}>{data.totals.active}</Text>
          <Text style={styles.metricLabel}>Active</Text>
        </Card>
        <Card style={styles.metric}>
          <Text style={styles.metricValue}>{data.totals.gracePeriod}</Text>
          <Text style={styles.metricLabel}>Grace period</Text>
        </Card>
        <Card style={styles.metric}>
          <Text style={styles.metricValue}>{data.totals.cancelled}</Text>
          <Text style={styles.metricLabel}>Cancelled</Text>
        </Card>
      </View>
      <Text style={styles.sectionTitle}>By tier</Text>
      <View style={styles.badges}>
        {Object.entries(data.byTier).map(([tier, count]) => (
          <Badge key={tier} label={`${tier}: ${count}`} tone="secondary" />
        ))}
      </View>
      <Text style={styles.sectionTitle}>Recent</Text>
      {data.recent.map((membership, index) => (
        <Card key={index} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{membership.handle ? `@${membership.handle}` : "Subscriber"}</Text>
            <Text style={styles.rowMeta}>
              {membership.tier} · since {new Date(membership.startedAt).toLocaleDateString()}
            </Text>
          </View>
          <Badge label={membership.status.replaceAll("_", " ")} tone={membership.status === "active" ? "secondary" : "warning"} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  grid: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: "900" },
  metricLabel: { color: colors.textMuted, fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowTitle: { color: colors.text, fontWeight: "800" },
  rowMeta: { color: colors.textMuted, fontSize: 12 }
});
