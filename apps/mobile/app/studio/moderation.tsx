import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { useStudioModeration } from "../../src/features/studio/studioData";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, radii, spacing } from "../../src/design/theme";

export default function StudioModeration() {
  const router = useRouter();
  const { appealVideoId } = useLocalSearchParams<{ appealVideoId?: string }>();
  const { data, reload } = useStudioModeration();
  const [appealingCaseId, setAppealingCaseId] = useState<string | null>(appealVideoId ? "from-video" : null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const submitAppeal = async (caseId: string | null) => {
    if (message.trim().length < 10) {
      setStatus("Please describe why the decision should be reviewed (at least 10 characters).");
      return;
    }
    setStatus(null);
    if (!isApiConfigured()) {
      setStatus("Appeal recorded (demo mode). Real appeals return the case to the moderation queue.");
      setAppealingCaseId(null);
      setMessage("");
      return;
    }
    try {
      await apiFetch("/appeals", {
        method: "POST",
        body: JSON.stringify(
          caseId && caseId !== "from-video"
            ? { caseId, message: message.trim() }
            : { videoId: appealVideoId, message: message.trim() }
        )
      });
      setStatus("Appeal submitted. The case is back in the review queue.");
      setAppealingCaseId(null);
      setMessage("");
      reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Appeal failed");
    }
  };

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Moderation</Text>
      <Text style={styles.subtitle}>
        {data.warnings > 0
          ? `You have ${data.warnings} active warning${data.warnings === 1 ? "" : "s"}. Repeated violations can pause monetization and payouts.`
          : "No active warnings. Keep following the Community Guidelines to stay in good standing."}
      </Text>
      <Button label="Read community guidelines" variant="ghost" onPress={() => router.push("/legal/community-guidelines")} style={{ marginBottom: spacing.lg }} />

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {appealingCaseId ? (
        <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          <Text style={styles.cardTitle}>Appeal decision</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Explain why this decision should be reviewed…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Button label="Submit appeal" onPress={() => submitAppeal(appealingCaseId)} />
          <Button label="Cancel" variant="ghost" onPress={() => setAppealingCaseId(null)} />
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>Cases</Text>
      {data.cases.length === 0 ? <Text style={styles.copy}>No moderation cases on your content.</Text> : null}
      {data.cases.map((moderationCase) => (
        <Card key={moderationCase.id} style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>
              {moderationCase.targetType}: {moderationCase.targetId.slice(0, 12)}
            </Text>
            <Badge
              label={moderationCase.status}
              tone={moderationCase.status === "resolved" ? "primary" : "warning"}
            />
          </View>
          <Text style={styles.copy}>
            Reason: {moderationCase.reason.replaceAll("_", " ")}
            {moderationCase.resolvedAction ? ` · Decision: ${moderationCase.resolvedAction.replaceAll("_", " ")}` : ""}
          </Text>
          {moderationCase.status === "resolved" ? (
            <Button label="Appeal this decision" variant="ghost" onPress={() => setAppealingCaseId(moderationCase.id)} />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: spacing.lg, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontWeight: "900" },
  copy: { color: colors.textSoft, lineHeight: 20 },
  status: { color: colors.warning, fontWeight: "700", marginBottom: spacing.md },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.md,
    minHeight: 90,
    textAlignVertical: "top"
  }
});
