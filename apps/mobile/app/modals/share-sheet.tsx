import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ModalShell } from "../../src/components/ModalShell";
import { colors, radii, spacing } from "../../src/design/theme";

const shareTargets: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "copy", label: "Copy link", icon: "link" },
  { id: "message", label: "Message", icon: "chatbubble-ellipses" },
  { id: "more", label: "More apps", icon: "share-social" }
];

export default function ShareSheet() {
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://vuqiro.app/v/${videoId ?? "video"}`;

  return (
    <ModalShell title="Share" subtitle="Share this video outside Vuqiro.">
      <View style={styles.linkBox}>
        <Text style={styles.link} numberOfLines={1}>
          {shareUrl}
        </Text>
      </View>
      <View style={styles.targets}>
        {shareTargets.map((target) => (
          <Pressable
            key={target.id}
            style={styles.target}
            onPress={() => {
              if (target.id === "copy") setCopied(true);
            }}
          >
            <View style={styles.targetIcon}>
              <Ionicons name={target.icon} size={22} color={colors.text} />
            </View>
            <Text style={styles.targetLabel}>
              {target.id === "copy" && copied ? "Copied!" : target.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>
        Native share integration is connected when real video URLs exist. Share events count toward
        video analytics.
      </Text>
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
