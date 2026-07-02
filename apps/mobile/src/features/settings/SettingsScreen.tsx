import React from "react";
import { StyleSheet, Text } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../design/theme";

const links = ["Terms of Service", "Privacy Policy", "Community Guidelines", "Creator Terms", "Payout Terms", "Report a problem", "Delete account"];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={onBack} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Vuqiro by Diversa Solutions LLC</Text>
      {links.map((link) => (
        <Card key={link} style={styles.row}>
          <Text style={styles.link}>{link}</Text>
          <Text style={styles.chevron}>›</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.xl },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  link: { color: colors.text, fontWeight: "800" },
  chevron: { color: colors.textMuted, fontSize: 22 }
});
