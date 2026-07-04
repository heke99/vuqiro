import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReportReason } from "@vuqiro/types";
import { Button } from "../../src/components/Button";
import { ModalShell } from "../../src/components/ModalShell";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, radii, spacing } from "../../src/design/theme";

const reasons: { code: ReportReason; label: string }[] = [
  { code: "harassment", label: "Harassment" },
  { code: "hate", label: "Hate" },
  { code: "violence", label: "Violence" },
  { code: "sexual_content", label: "Sexual content" },
  { code: "minor_safety", label: "Minor safety" },
  { code: "spam", label: "Spam" },
  { code: "scam", label: "Scam" },
  { code: "copyright", label: "Copyright" },
  { code: "misinformation", label: "Misinformation" },
  { code: "other", label: "Other" }
];

export default function ReportModal() {
  const { targetType, targetId } = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if (isApiConfigured() && targetId) {
        await apiFetch("/reports", {
          method: "POST",
          body: JSON.stringify({
            targetType: targetType ?? "video",
            targetId,
            reason: selected
          })
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
          Thank you. Our moderation team will review this {targetType ?? "content"}. You can also
          block the account from their profile to stop seeing their content.
        </Text>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={targetType === "profile" ? "Report profile" : targetType === "comment" ? "Report comment" : "Report content"}
      subtitle="Reports go to Vuqiro moderation for review. Serious safety reports are prioritized."
    >
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
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Button
        label={busy ? "Submitting…" : selected ? "Submit report" : "Select a reason"}
        variant={selected ? "danger" : "ghost"}
        onPress={submit}
        style={{ marginTop: spacing.lg }}
      />
      {targetId ? <Text style={styles.meta}>Reference: {targetType} · {targetId}</Text> : null}
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
  meta: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, textAlign: "center" },
  errorText: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
  confirmation: { color: colors.textSoft, lineHeight: 22 }
});
