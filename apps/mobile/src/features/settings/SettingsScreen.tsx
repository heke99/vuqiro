import { useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../design/theme";

const legalLinks: { label: string; href: Href }[] = [
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Community Guidelines", href: "/legal/community-guidelines" },
  { label: "Creator Terms", href: "/legal/creator-terms" },
  { label: "Payout Terms", href: "/legal/payout-terms" }
];

export function SettingsScreen() {
  const router = useRouter();
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Screen>
      <Button
        label="Back"
        variant="ghost"
        onPress={() => router.back()}
        style={{ alignSelf: "flex-start", marginBottom: spacing.md }}
      />
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Vuqiro by Diversa Solutions LLC</Text>

      <Text style={styles.sectionTitle}>Legal</Text>
      {legalLinks.map((link) => (
        <Pressable key={link.label} onPress={() => router.push(link.href)}>
          <Card style={styles.row}>
            <Text style={styles.link}>{link.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>Privacy</Text>
      <Card style={styles.row}>
        <Text style={styles.link}>Blocked accounts</Text>
        <Text style={styles.chevron}>›</Text>
      </Card>
      <Card style={styles.row}>
        <Text style={styles.link}>Notification preferences</Text>
        <Text style={styles.chevron}>›</Text>
      </Card>

      <Text style={styles.sectionTitle}>Support</Text>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/modals/report", params: { targetType: "problem", targetId: "app" } })
        }
      >
        <Card style={styles.row}>
          <Text style={styles.link}>Report a problem</Text>
          <Text style={styles.chevron}>›</Text>
        </Card>
      </Pressable>
      <Card style={styles.row}>
        <Text style={styles.link}>Contact support</Text>
        <Text style={styles.supportEmail}>support@vuqiro.app</Text>
      </Card>

      <Text style={styles.sectionTitle}>Account</Text>
      {deleteRequested ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.deleteTitle}>Deletion requested</Text>
          <Text style={styles.deleteCopy}>
            Your account deletion request has been recorded. When the backend is connected, your
            account and data will be permanently removed within 30 days. You can cancel by
            contacting support.
          </Text>
          <Button label="Cancel deletion request" variant="ghost" onPress={() => setDeleteRequested(false)} />
        </Card>
      ) : confirmingDelete ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.deleteTitle}>Delete your account?</Text>
          <Text style={styles.deleteCopy}>
            This will permanently delete your profile, videos, comments, wallet and subscriptions.
            This action cannot be undone.
          </Text>
          <Button
            label="Yes, delete my account"
            variant="danger"
            onPress={() => {
              setConfirmingDelete(false);
              setDeleteRequested(true);
            }}
          />
          <Button label="Keep my account" variant="ghost" onPress={() => setConfirmingDelete(false)} />
        </Card>
      ) : (
        <Pressable onPress={() => setConfirmingDelete(true)}>
          <Card style={styles.row}>
            <Text style={styles.deleteLink}>Delete account</Text>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Vuqiro v0.1.0</Text>
        <Text style={styles.footerText}>© Diversa Solutions LLC</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.sm
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  link: { color: colors.text, fontWeight: "800" },
  chevron: { color: colors.textMuted, fontSize: 22 },
  supportEmail: { color: colors.secondary, fontWeight: "800" },
  deleteLink: { color: colors.danger, fontWeight: "800" },
  deleteTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  deleteCopy: { color: colors.textSoft, lineHeight: 20 },
  footer: { alignItems: "center", marginTop: spacing.xl, gap: 2 },
  footerText: { color: colors.textMuted, fontSize: 12 }
});
