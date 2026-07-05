import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { ModalShell } from "../../src/components/ModalShell";
import { trackEvent } from "../../src/features/video/videoEvents";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, radii, spacing } from "../../src/design/theme";

const shareTargets: { id: "copy" | "system"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "copy", label: "Copy link", icon: "link" },
  { id: "system", label: "Share via…", icon: "share-social" }
];

export default function ShareSheet() {
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://vuqiro.app/v/${videoId ?? "video"}`;

  const recordShare = (channel: "copy_link" | "system_sheet") => {
    trackEvent("video_share", { videoId: videoId ?? "unknown" });
    if (isApiConfigured() && videoId) {
      apiFetch(`/videos/${videoId}/share`, {
        method: "POST",
        body: JSON.stringify({ channel })
      }).catch(() => {
        // share counters are best-effort
      });
    }
  };

  const onTarget = async (target: "copy" | "system") => {
    if (target === "copy") {
      try {
        await Clipboard.setStringAsync(shareUrl);
        setCopied(true);
        recordShare("copy_link");
      } catch {
        // clipboard unavailable (e.g. some web contexts) — leave label as-is
      }
      return;
    }
    recordShare("system_sheet");
    try {
      await Share.share({ message: `Watch this on Vuqiro: ${shareUrl}`, url: shareUrl });
    } catch {
      // user dismissed the sheet
    }
  };

  return (
    <ModalShell title="Share" subtitle="Share this video outside Vuqiro.">
      <View style={styles.linkBox}>
        <Text style={styles.link} numberOfLines={1}>
          {shareUrl}
        </Text>
      </View>
      <View style={styles.targets}>
        {shareTargets.map((target) => (
          <Pressable key={target.id} style={styles.target} onPress={() => onTarget(target.id)}>
            <View style={styles.targetIcon}>
              <Ionicons name={target.icon} size={22} color={colors.text} />
            </View>
            <Text style={styles.targetLabel}>{target.id === "copy" && copied ? "Copied!" : target.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>Share events count toward video analytics and the creator's reach.</Text>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  linkBox: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  link: { color: colors.secondary, fontWeight: "700" },
  targets: { flexDirection: "row", gap: spacing.lg },
  target: { alignItems: "center", gap: spacing.xs },
  targetIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  targetLabel: { color: colors.textSoft, fontSize: 12, fontWeight: "700" },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.lg }
});
