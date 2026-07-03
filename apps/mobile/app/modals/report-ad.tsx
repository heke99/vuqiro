import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AdReportReason } from "@vuqiro/types";
import { Button } from "../../src/components/Button";
import { ModalShell } from "../../src/components/ModalShell";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, radii, spacing } from "../../src/design/theme";

const reasons: { code: AdReportReason; label: string }[] = [
  { code: "misleading", label: "Misleading" },
  { code: "offensive", label: "Offensive" },
  { code: "scam", label: "Scam" },
  { code: "adult_content", label: "Adult content" },
  { code: "dangerous_product", label: "Dangerous product" },
  { code: "irrelevant", label: "Not relevant" },
  { code: "other", label: "Other" }
];

export default function ReportAdModal() {
  const { creativeId } = useLocalSearchParams<{ creativeId?: string }>();
  const [selected, setSelected] = useState<AdReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!selected || !creativeId) return;
    setBusy(true);
    setError(null);
    try {
      if (isApiConfigured()) {
        await apiFetch("/ads/report", {
          method: "POST",
          body: JSON.stringify({ creativeId, reason: selected })
        });
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit the report.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <ModalShell title="Report received" closeLabel="Done">
        <Text style={styles.confirmation}>
          Thank you. Our ads team will review this ad. Repeatedly reported ads are paused automatically while under
          review.
        </Text>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Report ad" subtitle="Tell us what's wrong with this sponsored content.">
      <View style={styles.reasons}>
        {reasons.map((reason) => (
          <Pressable
            key={reason.code}
            style={[styles.reason, selected === reason.code && styles.reasonSelected]}
            onPress={() => setSelected(reason.code)}
          >
            <Text style={[styles.reasonText, selected === reason.code && styles.reasonTextSelected]}>
              {reason.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={busy ? "Submitting…" : selected ? "Submit report" : "Select a reason"}
        variant={selected ? "danger" : "ghost"}
        onPress={submit}
        style={{ marginTop: spacing.lg }}
      />
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  reason: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated
  },
  reasonSelected: { backgroundColor: colors.danger, borderColor: colors.danger },
  reasonText: { color: colors.textSoft, fontWeight: "800", fontSize: 13 },
  reasonTextSelected: { color: colors.white },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
  confirmation: { color: colors.textSoft, lineHeight: 22 }
});
