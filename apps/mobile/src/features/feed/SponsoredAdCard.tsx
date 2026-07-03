import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServedAd } from "@vuqiro/types";
import { colors, radii, spacing } from "../../design/theme";
import { trackAdClick, trackAdImpression } from "../../services/data/feedTracking";

/**
 * Native sponsored card rendered inside the vertical feed. Always clearly
 * labeled "Sponsored"; CTA opens the destination URL and logs the click.
 */
export function SponsoredAdCard({ ad, height, isActive }: { ad: ServedAd; height: number; isActive: boolean }) {
  const router = useRouter();
  const impressionSent = useRef(false);

  useEffect(() => {
    if (isActive && !impressionSent.current) {
      impressionSent.current = true;
      void trackAdImpression(ad.creativeId);
    }
  }, [isActive, ad.creativeId]);

  const openCta = async () => {
    void trackAdClick(ad.creativeId);
    try {
      await Linking.openURL(ad.ctaUrl);
    } catch {
      // invalid/unsupported URL — nothing to do
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      {ad.thumbnailUrl ? (
        <Image source={{ uri: ad.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackBackground]} />
      )}
      <View style={styles.scrim} />
      <View style={styles.content}>
        <View style={styles.sponsoredRow}>
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/modals/report-ad", params: { creativeId: ad.creativeId } })
            }
            hitSlop={12}
          >
            <Text style={styles.reportLink}>Report ad</Text>
          </Pressable>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.advertiser}>{ad.advertiserName}</Text>
          <Text style={styles.title}>{ad.title}</Text>
          {ad.body ? <Text style={styles.body}>{ad.body}</Text> : null}
          <Pressable style={styles.cta} onPress={openCta}>
            <Text style={styles.ctaText}>{ad.ctaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", backgroundColor: colors.surface },
  fallbackBackground: { backgroundColor: colors.surfaceElevated },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(8,8,14,0.45)" },
  content: { flex: 1, justifyContent: "space-between", padding: spacing.xl, paddingTop: 100, paddingBottom: 120 },
  sponsoredRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sponsoredBadge: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4
  },
  sponsoredText: { color: colors.text, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  reportLink: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  bottom: { gap: spacing.sm },
  advertiser: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  body: { color: colors.textSoft, fontSize: 15, lineHeight: 22 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md
  },
  ctaText: { color: colors.white, fontWeight: "900", fontSize: 16 }
});
