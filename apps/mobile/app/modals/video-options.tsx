import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ModalShell } from "../../src/components/ModalShell";
import { useSocial } from "../../src/features/social/SocialContext";
import { trackEvent } from "../../src/features/video/videoEvents";
import { colors, radii, spacing } from "../../src/design/theme";

/** Long-press / "more" menu for a feed video: feed controls + safety actions. */
export default function VideoOptions() {
  const { videoId, creatorId, creatorHandle } = useLocalSearchParams<{
    videoId?: string;
    creatorId?: string;
    creatorHandle?: string;
  }>();
  const router = useRouter();
  const social = useSocial();

  const muted = creatorId ? social.isMuted(creatorId) : false;
  const notInterested = videoId ? social.isNotInterested(videoId) : false;
  const handleLabel = creatorHandle ? `@${creatorHandle}` : "this creator";

  const options: {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint: string;
    danger?: boolean;
    onPress: () => void;
  }[] = [
    {
      id: "not_interested",
      icon: "remove-circle-outline",
      label: notInterested ? "Undo not interested" : "Not interested",
      hint: "See fewer videos like this in your For You feed.",
      onPress: () => {
        if (videoId) social.markNotInterested(videoId);
        router.back();
      }
    },
    {
      id: "mute",
      icon: muted ? "volume-high-outline" : "volume-mute-outline",
      label: muted ? `Unmute ${handleLabel}` : `Mute ${handleLabel}`,
      hint: "Hide their videos from your feeds. They won't know.",
      onPress: () => {
        if (creatorId) social.toggleMute(creatorId);
        router.back();
      }
    },
    {
      id: "report",
      icon: "flag-outline",
      label: "Report video",
      hint: "Something here breaks the community guidelines.",
      danger: true,
      onPress: () => {
        trackEvent("video_report", { videoId });
        router.replace({ pathname: "/modals/report", params: { targetType: "video", targetId: videoId ?? "" } });
      }
    }
  ];

  return (
    <ModalShell title="Video options" subtitle="Tune your feed or report a problem.">
      <View style={styles.list}>
        {options.map((option) => (
          <Pressable key={option.id} style={styles.option} onPress={option.onPress}>
            <View style={[styles.iconWrap, option.danger && styles.iconWrapDanger]}>
              <Ionicons name={option.icon} size={22} color={option.danger ? colors.danger : colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, option.danger && { color: colors.danger }]}>{option.label}</Text>
              <Text style={styles.hint}>{option.hint}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapDanger: { backgroundColor: "rgba(239,68,68,0.12)" },
  label: { color: colors.text, fontWeight: "900", fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 }
});
