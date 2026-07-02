import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { useStudioPayouts } from "../../src/features/studio/studioData";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, spacing } from "../../src/design/theme";

export default function StudioPayouts() {
  const router = useRouter();
  const { data, reload } = useStudioPayouts();
  const [status, setStatus] = useState<string | null>(null);

  const startOnboarding = async () => {
    setStatus(null);
    if (!isApiConfigured()) {
      setStatus("Demo mode: Stripe onboarding opens here once the backend is connected.");
      return;
    }
    try {
      const response = await apiFetch<{ onboardingUrl: string }>("/payouts/onboarding", { method: "POST" });
      await Linking.openURL(response.onboardingUrl);
      reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Onboarding failed");
    }
  };

  const needsOnboarding = data.account.status === "not_onboarded" || data.account.status === "onboarding_started";

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Payouts</Text>
      <Text style={styles.subtitle}>Earnings are paid out via Stripe Connect once your balance passes ${data.minimumPayout}.</Text>

      <Card style={{ gap: spacing.sm }}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Stripe account</Text>
          <Badge
            label={data.account.status.replaceAll("_", " ")}
            tone={data.account.payoutsEnabled ? "secondary" : "warning"}
          />
        </View>
        {needsOnboarding ? (
          <>
            <Text style={styles.copy}>
              Complete Stripe onboarding to receive payouts. You&apos;ll verify your identity and add a
              bank account. By continuing you accept the Payout Terms.
            </Text>
            <Button label="Start Stripe onboarding" onPress={startOnboarding} />
            <Button label="Read payout terms" variant="ghost" onPress={() => router.push("/legal/payout-terms")} />
          </>
        ) : (
          <Text style={styles.copy}>
            {data.account.payoutsEnabled
              ? "Payouts are enabled. Balances are batched automatically."
              : "Your account is restricted. Check your Stripe dashboard for required information."}
          </Text>
        )}
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </Card>

      <View style={styles.grid}>
        <Card style={styles.metric}>
          <Text style={styles.metricValue}>${data.payableBalance.toFixed(2)}</Text>
          <Text style={styles.metricLabel}>Payable</Text>
        </Card>
        <Card style={styles.metric}>
          <Text style={styles.metricValue}>${data.pendingBalance.toFixed(2)}</Text>
          <Text style={styles.metricLabel}>Pending</Text>
        </Card>
        <Card style={styles.metric}>
          <Text style={styles.metricValue}>${(data.heldBalance ?? 0).toFixed(2)}</Text>
          <Text style={styles.metricLabel}>Held</Text>
        </Card>
      </View>

      {data.holds.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Active holds</Text>
          {data.holds.map((hold) => (
            <Card key={hold.id} style={{ gap: 4 }}>
              <Badge label={hold.reason.replaceAll("_", " ")} tone="warning" />
              <Text style={styles.copy}>{hold.note ?? "Your payouts are temporarily held. Support will contact you."}</Text>
            </Card>
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Payout history</Text>
      {data.payouts.length === 0 ? <Text style={styles.copy}>No payouts yet.</Text> : null}
      {data.payouts.map((payout) => (
        <Card key={payout.id} style={styles.payoutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              ${payout.amount.toLocaleString()} {payout.currency}
            </Text>
            <Text style={styles.rowMeta}>
              {new Date(payout.createdAt).toLocaleDateString()}
              {payout.failureReason ? ` · ${payout.failureReason}` : ""}
            </Text>
          </View>
          <Badge
            label={payout.status}
            tone={payout.status === "paid" ? "secondary" : payout.status === "failed" ? "warning" : "primary"}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  copy: { color: colors.textSoft, lineHeight: 20 },
  status: { color: colors.warning, fontWeight: "700" },
  grid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  metricLabel: { color: colors.textMuted, fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  payoutRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowTitle: { color: colors.text, fontWeight: "800" },
  rowMeta: { color: colors.textMuted, fontSize: 12 }
});
