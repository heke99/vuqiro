import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { useAuth } from "../src/features/auth/AuthContext";
import { colors, spacing } from "../src/design/theme";

/**
 * Shown instead of the app when the account is suspended, banned or pending
 * deletion. Suspended users can appeal; deletion can be cancelled in the
 * grace period.
 */
export default function AccountStatusScreen() {
  const router = useRouter();
  const auth = useAuth();
  const status = auth.profile?.status ?? "active";

  const content =
    status === "banned"
      ? {
          icon: "⛔",
          title: "Account banned",
          copy: "This account permanently violated the Vuqiro Community Guidelines and can no longer be used. If you believe this is a mistake you can submit an appeal from a signed-in session or contact support@vuqiro.app."
        }
      : status === "suspended"
        ? {
            icon: "⏸",
            title: "Account suspended",
            copy: "Your account is temporarily suspended for violating the Vuqiro Community Guidelines. You can submit an appeal — our moderation team reviews every appeal."
          }
        : {
            icon: "🗑",
            title: "Deletion requested",
            copy: "Your account is scheduled for deletion. You can cancel the request within the 30-day grace period from Settings; after that, your profile and content are removed permanently."
          };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.icon}>{content.icon}</Text>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.copy}>{content.copy}</Text>
        {status === "deletion_requested" ? (
          <Button
            label="Cancel deletion request"
            onPress={async () => {
              const result = await auth.cancelAccountDeletion();
              if (result.ok) router.replace("/(tabs)/feed");
            }}
          />
        ) : null}
        <Button label="Community Guidelines" variant="ghost" onPress={() => router.push("/legal/community-guidelines")} />
        <Button
          label="Sign out"
          variant="ghost"
          onPress={async () => {
            await auth.signOut();
            router.replace("/(public)/welcome");
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: spacing.md, paddingBottom: 80 },
  icon: { fontSize: 56, textAlign: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", textAlign: "center" },
  copy: { color: colors.textSoft, lineHeight: 22, textAlign: "center", marginBottom: spacing.lg }
});
