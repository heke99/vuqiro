import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { Button } from "../../src/components/Button";
import { ModalShell } from "../../src/components/ModalShell";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { isDemoContentAllowed } from "../../src/services/data/demoMode";
import { colors, radii, spacing } from "../../src/design/theme";

type LockedVideoMeta = {
  id: string;
  caption: string;
  visibility: string;
  coinUnlockPrice?: number;
  requiredTier?: string;
  creatorId: string;
  creatorHandle: string;
  creatorDisplayName: string;
};

function demoMeta(videoId?: string): LockedVideoMeta {
  const video = mockVideos.find((item) => item.id === videoId) ?? mockVideos[1];
  const creator = mockCreators.find((item) => item.id === video.creatorId) ?? mockCreators[0];
  return {
    id: video.id,
    caption: video.caption,
    visibility: video.visibility,
    coinUnlockPrice: video.coinUnlockPrice,
    requiredTier: video.requiredTier,
    creatorId: creator.id,
    creatorHandle: creator.handle,
    creatorDisplayName: creator.displayName
  };
}

export default function LockedContentModal() {
  const router = useRouter();
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const [meta, setMeta] = useState<LockedVideoMeta | null>(
    !isApiConfigured() && isDemoContentAllowed() ? demoMeta(videoId) : null
  );
  const [state, setState] = useState<"idle" | "busy" | "unlocked" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiConfigured() || !videoId) return;
    let active = true;
    apiFetch<{ video: LockedVideoMeta }>(`/videos/${videoId}`)
      .then((response) => {
        if (active) setMeta(response.video);
      })
      .catch(() => {
        if (active && isDemoContentAllowed()) setMeta(demoMeta(videoId));
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  if (!meta) {
    return (
      <ModalShell title="Locked content" subtitle="Loading…">
        <Text style={styles.optionCopy}>Fetching video details…</Text>
      </ModalShell>
    );
  }

  const video = meta;
  const creator = { id: meta.creatorId, handle: meta.creatorHandle, displayName: meta.creatorDisplayName };
  const isCoinUnlock = video.visibility === "unlock_with_coins";

  const unlock = async () => {
    const id = videoId ?? video.id;
    setState("busy");
    setError(null);
    if (!isApiConfigured()) {
      setState("error");
      setError("Demo mode — unlocks activate when the API is configured.");
      return;
    }
    try {
      await apiFetch("/wallet/unlock", {
        method: "POST",
        body: JSON.stringify({ videoId: id, idempotencyKey: `unlock-${id}-${Date.now()}` })
      });
      setState("unlocked");
    } catch (unlockError) {
      setState("error");
      setError(unlockError instanceof Error ? unlockError.message : "Unlock failed.");
    }
  };

  if (state === "unlocked") {
    return (
      <ModalShell title="Unlocked!" closeLabel="Watch now">
        <Text style={styles.optionCopy}>
          You now have permanent access to this video. Your coins went to {creator.displayName} (minus the platform
          fee).
        </Text>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={isCoinUnlock ? "Unlock this video" : "Subscribers only"}
      subtitle={`From ${creator.displayName} (@${creator.handle})`}
    >
      <View style={styles.preview}>
        <Text style={styles.previewIcon}>🔒</Text>
        <Text style={styles.previewCaption}>{video.caption}</Text>
      </View>
      {isCoinUnlock ? (
        <View style={styles.option}>
          <Text style={styles.optionTitle}>Unlock with coins</Text>
          <Text style={styles.optionCopy}>
            Pay {video.coinUnlockPrice} coins once and watch this video forever.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={state === "busy" ? "Unlocking…" : `Unlock for ${video.coinUnlockPrice} coins`}
            onPress={unlock}
          />
          <Button
            label="Get more coins"
            variant="ghost"
            onPress={() => router.push({ pathname: "/modals/coins", params: { creatorId: creator.id } })}
          />
        </View>
      ) : (
        <View style={styles.option}>
          <Text style={styles.optionTitle}>Subscribe to watch</Text>
          <Text style={styles.optionCopy}>
            This video is available to {creator.displayName}&apos;s subscribers
            {video.requiredTier ? ` on the ${video.requiredTier} tier and above` : ""}.
          </Text>
          <Button
            label="See subscription options"
            onPress={() =>
              router.push({ pathname: "/modals/subscribe", params: { creatorId: creator.id } })
            }
          />
        </View>
      )}
      <Text style={styles.note}>
        Access to locked content is always verified by the Vuqiro backend. Purchases use App Store /
        Google Play billing.
      </Text>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  preview: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  previewIcon: { fontSize: 40 },
  previewCaption: { color: colors.textSoft, textAlign: "center", lineHeight: 20 },
  option: { gap: spacing.sm },
  optionTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  optionCopy: { color: colors.textSoft, lineHeight: 20, marginBottom: spacing.xs },
  error: { color: colors.danger, fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.lg }
});
