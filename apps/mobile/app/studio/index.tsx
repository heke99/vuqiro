import { useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { useStudioAnalytics } from "../../src/features/studio/studioData";
import { colors, spacing } from "../../src/design/theme";

const sections: { label: string; copy: string; href: Href }[] = [
  { label: "Videos", copy: "Manage uploads, visibility and monetization", href: "/studio/videos" },
  { label: "Subscribers", copy: "Membership overview by tier", href: "/studio/subscribers" },
  { label: "Payouts", copy: "Balance, Stripe status and payout history", href: "/studio/payouts" },
  { label: "Moderation", copy: "Warnings, cases and appeals", href: "/studio/moderation" },
  { label: "Settings", copy: "Subscription tiers and storefront", href: "/studio/settings" }
];

export default function StudioOverview() {
  const router = useRouter();
  const { data: analytics, isLive } = useStudioAnalytics();

  const cards: [string, string][] = [
    ["Views", analytics.views.toLocaleString()],
    ["Watch time", `${analytics.watchTimeHours.toLocaleString()} h`],
    ["Completion", `${Math.round(analytics.completionRate * 100)}%`],
    ["Followers gained", `+${analytics.followersGained.toLocaleString()}`],
    ["Subscribers gained", `+${analytics.subscribersGained.toLocaleString()}`],
    ["Coin tips", `$${analytics.coinTips.toLocaleString()}`],
    ["Unlock revenue", `$${analytics.unlockRevenue.toLocaleString()}`],
    ["Subscriptions", `$${analytics.subscriptionRevenue.toLocaleString()}`],
    ["Payout pending", `$${analytics.payoutPending.toLocaleString()}`],
    ["Payout paid", `$${analytics.payoutPaid.toLocaleString()}`]
  ];

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.kicker}>Creator studio</Text>
      <Text style={styles.title}>Your creator business</Text>
      <Text style={styles.subtitle}>
        Last 30 days{isLive ? "" : " · demo data until the backend is connected"}
      </Text>
      <View style={styles.grid}>
        {cards.map(([label, value]) => (
          <Card key={label} style={styles.metric}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
          </Card>
        ))}
      </View>
      <Text style={styles.sectionTitle}>Manage</Text>
      {sections.map((section) => (
        <Pressable key={section.label} onPress={() => router.push(section.href)}>
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{section.label}</Text>
              <Text style={styles.rowCopy}>{section.copy}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { width: "48%", alignItems: "flex-start", gap: 2 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  metricLabel: { color: colors.textMuted, fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowTitle: { color: colors.text, fontWeight: "900" },
  rowCopy: { color: colors.textMuted, fontSize: 12 },
  chevron: { color: colors.textMuted, fontSize: 22 }
});
