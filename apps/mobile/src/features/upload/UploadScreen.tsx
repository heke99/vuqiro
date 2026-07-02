import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../design/theme";

const options = ["Public", "Followers only", "Subscribers only", "Unlock with coins"];

export function UploadScreen() {
  return (
    <Screen>
      <Text style={styles.kicker}>Create</Text>
      <Text style={styles.title}>Create a video</Text>
      <Text style={styles.subtitle}>Choose who can watch and how your audience can support it.</Text>
      <Card style={styles.dropzone}>
        <Text style={styles.dropIcon}>＋</Text>
        <Text style={styles.dropTitle}>Select video</Text>
        <Text style={styles.dropSub}>Upload processing and moderation will be enabled in a later backend batch.</Text>
      </Card>
      <Text style={styles.sectionTitle}>Visibility</Text>
      <View style={styles.options}>{options.map((option, index) => <Badge key={option} label={option} tone={index === 0 ? "secondary" : "primary"} />)}</View>
      <Text style={styles.sectionTitle}>Creator access</Text>
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>Required tier</Text>
        <View style={styles.options}><Badge label="Support" /><Badge label="Plus" tone="secondary" /><Badge label="Premium" tone="warning" /></View>
        <Text style={styles.label}>Coin unlock price</Text>
        <View style={styles.options}><Badge label="50 coins" /><Badge label="100 coins" tone="secondary" /><Badge label="250 coins" /></View>
      </Card>
      <Button label="Post video (mock)" style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  subtitle: { color: colors.textMuted, lineHeight: 22, marginBottom: spacing.xl },
  dropzone: { minHeight: 210, alignItems: "center", justifyContent: "center", gap: spacing.sm, borderStyle: "dashed" },
  dropIcon: { color: colors.primary, fontSize: 52, fontWeight: "200" },
  dropTitle: { color: colors.text, fontWeight: "900", fontSize: 20 },
  dropSub: { color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  label: { color: colors.textMuted, fontWeight: "800" }
});
