import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { useAuth } from "../src/features/auth/AuthContext";
import { apiFetch, isApiConfigured } from "../src/services/api/client";
import { colors, radii, spacing } from "../src/design/theme";

type MeResponse = {
  profile: {
    displayName: string;
    bio: string;
    websiteUrl?: string;
    country?: string;
    language?: string;
  };
};

export default function EditProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(auth.profile?.displayName ?? "");
  const [bio, setBio] = useState(auth.profile?.bio ?? "");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) return;
    apiFetch<MeResponse>("/me")
      .then((response) => {
        setDisplayName(response.profile.displayName);
        setBio(response.profile.bio);
        setWebsiteUrl(response.profile.websiteUrl ?? "");
      })
      .catch(() => {
        // keep auth-context values
      });
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (isApiConfigured()) {
        await apiFetch("/me", {
          method: "PATCH",
          body: JSON.stringify({
            displayName: displayName.trim(),
            bio: bio.trim(),
            websiteUrl: websiteUrl.trim() ? websiteUrl.trim() : null
          })
        });
      }
      setMessage("Profile updated.");
      setTimeout(() => router.back(), 600);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.kicker}>Profile</Text>
      <Text style={styles.title}>Edit profile</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={80}
        placeholder="Your name"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        maxLength={500}
        multiline
        placeholder="Tell people what you make"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Website</Text>
      <TextInput
        style={styles.input}
        value={websiteUrl}
        onChangeText={setWebsiteUrl}
        autoCapitalize="none"
        placeholder="https://…"
        placeholderTextColor={colors.textMuted}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button label={busy ? "Saving…" : "Save"} onPress={save} style={{ marginTop: spacing.lg }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      {!isApiConfigured() ? (
        <Text style={styles.note}>Demo mode — changes are not persisted until the API is configured.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginBottom: spacing.xl },
  label: { color: colors.textMuted, fontWeight: "800", fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  message: { color: colors.secondary, marginTop: spacing.md, fontWeight: "700" },
  note: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, textAlign: "center" }
});
