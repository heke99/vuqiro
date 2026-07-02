import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/AuthContext";
import { colors, radii, spacing } from "../../src/design/theme";

export default function SignInScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    const result = await auth.signIn(email.trim(), password);
    setBusy(false);
    if (result.ok) {
      router.replace("/(tabs)/feed");
    } else {
      setError(result.error ?? "Sign in failed");
    }
  };

  const magicLink = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    setBusy(true);
    const result = await auth.signInWithMagicLink(email.trim());
    setBusy(false);
    if (result.ok) {
      if (auth.isRealAuth) {
        setNotice("Magic link sent. Check your email.");
      } else {
        router.replace("/(tabs)/feed");
      }
    } else {
      setError(result.error ?? "Could not send magic link");
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
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to your Vuqiro account.</Text>
      <View style={styles.form}>
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
          placeholder="Your password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Button label={busy ? "Signing in…" : "Sign in"} onPress={submit} style={{ marginTop: spacing.md }} />
        <Button label="Send magic link instead" variant="ghost" onPress={magicLink} />
      </View>
      {!auth.isRealAuth ? (
        <Text style={styles.note}>
          Backend not configured — running in demo mode. Set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY for real authentication.
        </Text>
      ) : null}
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
  error: { color: colors.danger, fontWeight: "700", marginTop: spacing.sm },
  notice: { color: colors.success, fontWeight: "700", marginTop: spacing.sm },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.xl }
});
