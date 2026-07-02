import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../design/theme";

export type LegalSection = { heading: string; body: string };

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  const router = useRouter();
  return (
    <Screen>
      <Button
        label="Back"
        variant="ghost"
        onPress={() => router.back()}
        style={{ alignSelf: "flex-start", marginBottom: spacing.md }}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.owner}>Vuqiro — operated by Diversa Solutions LLC</Text>
      <Card style={styles.notice}>
        <Text style={styles.noticeText}>
          This is a product outline, not final legal text. Final documents will be reviewed by a
          qualified attorney before launch.
        </Text>
      </Card>
      {sections.map((section) => (
        <Card key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </Card>
      ))}
      <Text style={styles.footer}>Questions? Contact support@vuqiro.app</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  owner: { color: colors.textMuted, marginBottom: spacing.lg },
  notice: { borderColor: colors.warning, marginBottom: spacing.md },
  noticeText: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  section: { marginBottom: spacing.sm, gap: spacing.xs },
  heading: { color: colors.text, fontWeight: "900", fontSize: 16 },
  body: { color: colors.textSoft, lineHeight: 21 },
  footer: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, textAlign: "center" }
});
