import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { apiFetch, isApiConfigured } from "../src/services/api/client";
import { colors, spacing } from "../src/design/theme";

type Settings = {
  privacyLevel: "public" | "followers" | "private";
  commentPermission: "everyone" | "followers" | "no_one";
  likedVideosVisibility: "public" | "private";
  analyticsOptIn: boolean;
  personalizedAdsOptIn: boolean;
};

type SafetySettings = {
  restrictedMode: boolean;
  commentFilterLevel: "off" | "standard" | "strict";
};

const defaults: Settings = {
  privacyLevel: "public",
  commentPermission: "everyone",
  likedVideosVisibility: "private",
  analyticsOptIn: true,
  personalizedAdsOptIn: false
};

const safetyDefaults: SafetySettings = { restrictedMode: false, commentFilterLevel: "standard" };

export default function PrivacySettingsScreen() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [safety, setSafety] = useState<SafetySettings>(safetyDefaults);
  const [message, setMessage] = useState<string | null>(null);
  const [exportRequested, setExportRequested] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) return;
    apiFetch<{ settings: Settings }>("/me/settings")
      .then((response) => setSettings({ ...defaults, ...response.settings }))
      .catch(() => {});
    apiFetch<{ settings: SafetySettings }>("/me/safety-settings")
      .then((response) => setSafety({ ...safetyDefaults, ...response.settings }))
      .catch(() => {});
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (isApiConfigured()) {
      apiFetch("/me/settings", { method: "PUT", body: JSON.stringify(patch) }).catch(() =>
        setMessage("Could not save — check your connection.")
      );
    }
  };

  const updateSafety = (patch: Partial<SafetySettings>) => {
    const next = { ...safety, ...patch };
    setSafety(next);
    if (isApiConfigured()) {
      apiFetch("/me/safety-settings", { method: "PUT", body: JSON.stringify(patch) }).catch(() =>
        setMessage("Could not save — check your connection.")
      );
    }
  };

  const requestExport = async () => {
    setExportRequested(true);
    if (isApiConfigured()) {
      try {
        await apiFetch("/privacy/requests", { method: "POST", body: JSON.stringify({ type: "export" }) });
        setMessage("Data export requested — you'll be notified when it's ready.");
      } catch (error) {
        setExportRequested(false);
        setMessage(error instanceof Error ? error.message : "Could not request the export.");
      }
    } else {
      setMessage("Demo mode — export requests activate with a configured API.");
    }
  };

  const toggleRow = (title: string, copy: string, value: boolean, onChange: (next: boolean) => void) => (
    <Card style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </Card>
  );

  return (
    <Screen>
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Privacy & safety</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Text style={styles.sectionTitle}>Privacy</Text>
      {toggleRow(
        "Private account",
        "Only approved followers can see your videos.",
        settings.privacyLevel === "private",
        (next) => updateSettings({ privacyLevel: next ? "private" : "public" })
      )}
      {toggleRow(
        "Show liked videos",
        "Let others see the videos you've liked on your profile.",
        settings.likedVideosVisibility === "public",
        (next) => updateSettings({ likedVideosVisibility: next ? "public" : "private" })
      )}
      {toggleRow(
        "Comments from everyone",
        "Off limits comments on your videos to people you follow back.",
        settings.commentPermission === "everyone",
        (next) => updateSettings({ commentPermission: next ? "everyone" : "followers" })
      )}

      <Text style={styles.sectionTitle}>Data & ads</Text>
      {toggleRow(
        "Personalized ads",
        "Use your interests to pick more relevant sponsored content.",
        settings.personalizedAdsOptIn,
        (next) => updateSettings({ personalizedAdsOptIn: next })
      )}
      {toggleRow(
        "Analytics",
        "Share watch signals to improve recommendations.",
        settings.analyticsOptIn,
        (next) => updateSettings({ analyticsOptIn: next })
      )}

      <Text style={styles.sectionTitle}>Safety</Text>
      {toggleRow(
        "Restricted mode",
        "Filter out content that may not be appropriate for all audiences.",
        safety.restrictedMode,
        (next) => updateSafety({ restrictedMode: next })
      )}
      {toggleRow(
        "Strict comment filter",
        "Hide potentially offensive comments automatically.",
        safety.commentFilterLevel === "strict",
        (next) => updateSafety({ commentFilterLevel: next ? "strict" : "standard" })
      )}

      <Text style={styles.sectionTitle}>Your data</Text>
      <Button
        label={exportRequested ? "Export requested" : "Request a copy of my data"}
        variant="ghost"
        onPress={requestExport}
      />
      <Text style={styles.note}>
        Exports include your profile, videos, comments, likes and purchase history. Processing can take up to 30
        days; the download link expires after 7 days.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17, marginTop: spacing.xl, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.sm },
  rowTitle: { color: colors.text, fontWeight: "800" },
  rowCopy: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  message: { color: colors.secondary, fontWeight: "700", marginBottom: spacing.md },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.md }
});
