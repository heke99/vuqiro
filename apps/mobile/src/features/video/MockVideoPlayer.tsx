import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../design/theme";
import type { VideoPlayerProps } from "./videoTypes";

const MOCK_DURATION_SECONDS = 30;

/**
 * Placeholder player used when no playback URL exists (or the real player
 * fails). Simulates playback progress so watch analytics and completion
 * behaviour can be exercised without real video.
 */
export function MockVideoPlayer({ isActive = false, loop = true, onProgress, onComplete }: VideoPlayerProps) {
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      secondsRef.current += 1;
      if (secondsRef.current > MOCK_DURATION_SECONDS) {
        onComplete?.();
        if (loop) {
          secondsRef.current = 0;
        } else {
          clearInterval(interval);
          return;
        }
      }
      setSeconds(secondsRef.current);
      onProgress?.(secondsRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, loop, onComplete, onProgress]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["#111827", "#4C1D95", "#050507"]} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Text style={styles.brand}>Vuqiro Preview</Text>
        {isActive ? (
          <Text style={styles.timer}>
            0:{String(seconds).padStart(2, "0")} / 0:{MOCK_DURATION_SECONDS}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  brand: { color: "rgba(255,255,255,0.72)", fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  timer: { color: colors.textMuted, fontWeight: "800", fontVariant: ["tabular-nums"] }
});
