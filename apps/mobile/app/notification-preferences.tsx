import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { apiFetch, isApiConfigured } from "../src/services/api/client";
import { colors, spacing } from "../src/design/theme";

type PrefKey =
  | "followers"
  | "comments"
  | "creatorUpdates"
  | "purchases"
  | "payouts"
  | "moderation"
  | "system"
  | "messages"
  | "pushEnabled";

const prefLabels: { key: PrefKey; label: string; copy: string }[] = [
  { key: "followers", label: "New followers", copy: "When someone follows you" },
  { key: "comments", label: "Comments & replies", copy: "Activity on your videos and comments" },
  { key: "creatorUpdates", label: "Creator updates", copy: "New videos from creators you follow" },
  { key: "purchases", label: "Purchases & coins", copy: "Tips, unlocks and subscription activity" },
  { key: "payouts", label: "Payouts", copy: "Payout status changes (creators only)" },
  { key: "moderation", label: "Moderation", copy: "Safety notices about your content" },
  { key: "system", label: "System notices", copy: "Important platform announcements" },
  { key: "messages", label: "Direct messages", copy: "New messages in your inbox" },
  { key: "pushEnabled", label: "Push notifications", copy: "Deliver notifications to this device" }
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    followers: true,
    comments: true,
    creatorUpdates: true,
    purchases: true,
    payouts: true,
    moderation: true,
    system: true,
    messages: true,
    pushEnabled: false
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) return;
    apiFetch<{ preferences: Record<string, boolean> }>("/notifications/preferences")
      .then((response) => {
        const raw = response.preferences;
        setPrefs({
          followers: raw.followers ?? true,
          comments: raw.comments ?? true,
          creatorUpdates: raw.creator_updates ?? raw.creatorUpdates ?? true,
          purchases: raw.purchases ?? true,
          payouts: raw.payouts ?? true,
          moderation: raw.moderation ?? true,
          system: raw.system ?? true,
          messages: raw.messages ?? true,
          pushEnabled: raw.push_enabled ?? raw.pushEnabled ?? false
        });
      })
      .catch(() => {});
  }, []);

  const toggle = (key: PrefKey) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setStatus(null);
    if (isApiConfigured()) {
      apiFetch("/notifications/preferences", {
        method: "POST",
        body: JSON.stringify({ [key]: next[key] })
      })
        .then(() => setStatus("Saved"))
        .catch(() => setStatus("Save failed — will retry next change"));
    } else {
      setStatus("Saved (demo mode)");
    }
  };

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Notification preferences</Text>
      <Text style={styles.subtitle}>
        Choose what Vuqiro notifies you about. Moderation and account-security notices may still be
        sent when legally required.
      </Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {prefLabels.map((pref) => (
        <Card key={pref.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{pref.label}</Text>
            <Text style={styles.copy}>{pref.copy}</Text>
          </View>
          <Switch
            value={prefs[pref.key]}
            onValueChange={() => toggle(pref.key)}
            trackColor={{ true: colors.primary, false: colors.surfaceElevated }}
            thumbColor={colors.white}
          />
        </Card>
      ))}
      <Text style={styles.note}>
        Push delivery uses Expo Notifications and activates with a development build. See
        docs/architecture/push-notifications.md.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  status: { color: colors.success, fontWeight: "700", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  label: { color: colors.text, fontWeight: "800" },
  copy: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.lg }
});
