import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Visibility } from "@vuqiro/types";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { useFeatureFlags } from "../../services/data/featureFlags";
import { trackEvent } from "../video/videoEvents";
import { colors, radii, spacing } from "../../design/theme";

type UploadPhase = "idle" | "selected" | "requesting" | "uploading" | "processing" | "done" | "under_review" | "error";

const visibilityOptions: { value: Visibility; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "followers_only", label: "Followers only" },
  { value: "subscribers_only", label: "Subscribers only" },
  { value: "unlock_with_coins", label: "Unlock with coins" }
];

const tierOptions = ["support", "plus", "premium"] as const;
const coinPriceOptions = [50, 100, 250] as const;

export function UploadScreen() {
  const flags = useFeatureFlags();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [requiredTier, setRequiredTier] = useState<(typeof tierOptions)[number]>("support");
  const [coinPrice, setCoinPrice] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);

  const pickVideo = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (asset.duration && asset.duration > 180_000) {
      setError("Videos must be 180 seconds or shorter.");
      return;
    }
    setFileUri(asset.uri);
    setFileName(asset.fileName ?? `video_${Date.now()}.mp4`);
    setFileSize(asset.fileSize ?? 0);
    setPhase("selected");
    trackEvent("upload_started");
  };

  const submit = async () => {
    if (!caption.trim()) {
      setError("Add a caption before posting.");
      return;
    }
    setError(null);
    trackEvent("upload_submitted");
    const tags = hashtags
      .split(/[#,\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (!isApiConfigured()) {
      // Simulated pipeline in demo mode so the full status machine is visible.
      setPhase("requesting");
      setTimeout(() => setPhase("uploading"), 700);
      setTimeout(() => setPhase("processing"), 1800);
      setTimeout(() => setPhase("done"), 3200);
      return;
    }

    try {
      setPhase("requesting");
      const response = await apiFetch<{ videoId: string; uploadUrl: string; status: string }>(
        "/videos/uploads",
        {
          method: "POST",
          body: JSON.stringify({
            caption: caption.trim(),
            hashtags: tags,
            visibility,
            requiredTier: visibility === "subscribers_only" ? requiredTier : undefined,
            coinUnlockPrice: visibility === "unlock_with_coins" ? coinPrice : undefined,
            fileName: fileName ?? "video.mp4",
            fileSizeBytes: fileSize || 1
          })
        }
      );

      setPhase("uploading");
      if (fileUri && !response.uploadUrl.includes("mock.vuqiro.local")) {
        const file = await fetch(fileUri);
        const blob = await file.blob();
        await fetch(response.uploadUrl, { method: "PUT", body: blob });
      }

      setPhase("processing");
      // Poll processing status until ready/under review (max ~60s).
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const status = await apiFetch<{ status: string; moderationStatus: string }>(
          `/videos/${response.videoId}/status`
        );
        if (status.status === "ready") {
          setPhase("done");
          return;
        }
        if (status.status === "under_review" || status.moderationStatus === "under_review") {
          setPhase("under_review");
          return;
        }
        if (status.status === "rejected") {
          setPhase("error");
          setError("Processing failed. Try a different file.");
          return;
        }
      }
      setPhase("processing");
    } catch (submitError) {
      setPhase("error");
      setError(submitError instanceof Error ? submitError.message : "Upload failed");
    }
  };

  const reset = () => {
    setPhase("idle");
    setFileName(null);
    setFileUri(null);
    setCaption("");
    setHashtags("");
    setError(null);
  };

  const statusCopy: Record<UploadPhase, string> = {
    idle: "",
    selected: "Ready to post.",
    requesting: "Requesting secure upload…",
    uploading: "Uploading your video…",
    processing: "Processing & generating preview…",
    done: "Your video is live-ready!",
    under_review: "Uploaded — your video is in moderation review before it appears in feeds.",
    error: "Something went wrong."
  };

  if (!flags.videoUpload) {
    return (
      <Screen>
        <Text style={styles.kicker}>Create</Text>
        <Text style={styles.title}>Uploads paused</Text>
        <Text style={styles.subtitle}>
          Video uploads are temporarily disabled. Check back soon — your drafts and published videos are safe.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.kicker}>Create</Text>
      <Text style={styles.title}>Create a video</Text>
      <Text style={styles.subtitle}>Choose who can watch and how your audience can support it.</Text>

      <Pressable onPress={pickVideo}>
        <Card style={styles.dropzone}>
          <Text style={styles.dropIcon}>{fileName ? "🎬" : "＋"}</Text>
          <Text style={styles.dropTitle}>{fileName ?? "Select video"}</Text>
          <Text style={styles.dropSub}>
            Max 180 seconds · 500 MB · mp4/mov/webm · vertical 9:16 preferred
          </Text>
        </Card>
      </Pressable>

      <Text style={styles.sectionTitle}>Caption</Text>
      <TextInput
        style={styles.input}
        value={caption}
        onChangeText={setCaption}
        placeholder="Say something about your video…"
        placeholderTextColor={colors.textMuted}
        maxLength={500}
        multiline
      />
      <Text style={styles.sectionTitle}>Hashtags</Text>
      <TextInput
        style={styles.input}
        value={hashtags}
        onChangeText={setHashtags}
        placeholder="#music #studio"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />

      <Text style={styles.sectionTitle}>Visibility</Text>
      <View style={styles.options}>
        {visibilityOptions.map((option) => (
          <Pressable key={option.value} onPress={() => setVisibility(option.value)}>
            <Badge label={option.label} tone={visibility === option.value ? "secondary" : "primary"} />
          </Pressable>
        ))}
      </View>

      {visibility === "subscribers_only" ? (
        <>
          <Text style={styles.sectionTitle}>Required tier</Text>
          <View style={styles.options}>
            {tierOptions.map((tier) => (
              <Pressable key={tier} onPress={() => setRequiredTier(tier)}>
                <Badge label={tier} tone={requiredTier === tier ? "secondary" : "primary"} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {visibility === "unlock_with_coins" ? (
        <>
          <Text style={styles.sectionTitle}>Coin unlock price</Text>
          <View style={styles.options}>
            {coinPriceOptions.map((price) => (
              <Pressable key={price} onPress={() => setCoinPrice(price)}>
                <Badge label={`${price} coins`} tone={coinPrice === price ? "secondary" : "primary"} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {phase !== "idle" && phase !== "selected" ? (
        <Card style={styles.statusCard}>
          <Text style={styles.statusText}>{statusCopy[phase]}</Text>
          {phase === "done" || phase === "under_review" || phase === "error" ? (
            <Button label="Create another" variant="ghost" onPress={reset} />
          ) : null}
        </Card>
      ) : null}

      <Button
        label={
          phase === "requesting" || phase === "uploading" || phase === "processing"
            ? "Working…"
            : isApiConfigured()
              ? "Post video"
              : "Post video (demo)"
        }
        onPress={submit}
        style={{ marginTop: spacing.xl }}
      />
      {!isApiConfigured() ? (
        <Text style={styles.note}>
          Demo pipeline — set EXPO_PUBLIC_API_URL to upload through the real video provider.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  subtitle: { color: colors.textMuted, lineHeight: 22, marginBottom: spacing.xl },
  dropzone: { minHeight: 170, alignItems: "center", justifyContent: "center", gap: spacing.sm, borderStyle: "dashed" },
  dropIcon: { color: colors.primary, fontSize: 44, fontWeight: "200" },
  dropTitle: { color: colors.text, fontWeight: "900", fontSize: 18, textAlign: "center" },
  dropSub: { color: colors.textMuted, textAlign: "center", lineHeight: 20, fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.danger, fontWeight: "700", marginTop: spacing.md },
  statusCard: { marginTop: spacing.lg, gap: spacing.sm },
  statusText: { color: colors.textSoft, lineHeight: 20, fontWeight: "700" },
  note: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, textAlign: "center" }
});
