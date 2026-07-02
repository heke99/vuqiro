import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { Button } from "../../src/components/Button";
import { ModalShell } from "../../src/components/ModalShell";
import { colors, radii, spacing } from "../../src/design/theme";

export default function LockedContentModal() {
  const router = useRouter();
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const video = mockVideos.find((item) => item.id === videoId) ?? mockVideos[1];
  const creator = mockCreators.find((item) => item.id === video.creatorId) ?? mockCreators[0];
  const isCoinUnlock = video.visibility === "unlock_with_coins";

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
            Pay {video.coinUnlockPrice} coins once and watch this video forever. Your current
            balance: 1,250 coins.
          </Text>
          <Button label={`Unlock for ${video.coinUnlockPrice} coins`} />
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
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.lg }
});
