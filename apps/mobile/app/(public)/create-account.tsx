import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/AuthContext";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, radii, spacing } from "../../src/design/theme";

export default function CreateAccountScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!accepted) return;
    setError(null);
    setBusy(true);
    const result = await auth.signUp(email.trim(), password, handle.trim());
    if (result.ok && isApiConfigured()) {
      // Store the acceptance server-side (terms + privacy + guidelines).
      apiFetch("/legal/accept", {
        method: "POST",
        body: JSON.stringify({ documentTypes: ["terms", "privacy", "community_guidelines"] })
      }).catch(() => {});
    }
    setBusy(false);
    if (result.ok) {
      router.replace("/(tabs)/feed");
    } else {
      setError(result.error ?? "Could not create account");
    }
  };

  return (
    <Screen>
      <Button
        label="Back"
        variant="ghost"
        onPress={() => router.back()}
        style={{ alignSelf: "flex-start", marginBottom: spacing.lg }}
      />
      <Text style={styles.title}>Join Vuqiro</Text>
      <Text style={styles.subtitle}>Create your account and start discovering creators.</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Handle</Text>
        <TextInput
          style={styles.input}
          value={handle}
          onChangeText={setHandle}
          placeholder="@yourhandle"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Choose a strong password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
        <Pressable style={styles.acceptRow} onPress={() => setAccepted((value) => !value)}>
          <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
            {accepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.acceptText}>
            I accept the <Text style={styles.link} onPress={() => router.push("/legal/terms")}>Terms of Service</Text>,{" "}
            <Text style={styles.link} onPress={() => router.push("/legal/privacy")}>Privacy Policy</Text> and{" "}
            <Text style={styles.link} onPress={() => router.push("/legal/community-guidelines")}>
              Community Guidelines
            </Text>
            .
          </Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={busy ? "Creating account…" : accepted ? "Create account" : "Accept terms to continue"}
          onPress={submit}
          variant={accepted ? "primary" : "ghost"}
          style={{ marginTop: spacing.md }}
        />
      </View>
      <Text style={styles.note}>Vuqiro by Diversa Solutions LLC</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 22 },
  form: { gap: spacing.sm },
  label: { color: colors.textSoft, fontWeight: "800", marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16
  },
  acceptRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignItems: "flex-start" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.white, fontWeight: "900" },
  acceptText: { color: colors.textSoft, flex: 1, lineHeight: 20 },
  link: { color: colors.secondary, fontWeight: "800" },
  error: { color: colors.danger, fontWeight: "700", marginTop: spacing.sm },
  note: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xl }
});
