import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { MockVideoPlayer } from "./MockVideoPlayer";
import type { VideoPlayerProps } from "./videoTypes";

/**
 * Vuqiro video player adapter.
 *
 * Real playback uses expo-video (HLS + MP4, works in Expo Go and dev builds).
 * When no playback URL exists — or the player errors — it degrades to the
 * MockVideoPlayer so the app never crashes on video.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  const { playbackUrl } = props;
  const [failed, setFailed] = useState(false);

  if (!playbackUrl || failed) {
    return <MockVideoPlayer {...props} />;
  }
  return <NativeVideoPlayer {...props} playbackUrl={playbackUrl} onFatalError={() => setFailed(true)} />;
}

function NativeVideoPlayer({
  playbackUrl,
  thumbnailUrl,
  isActive = false,
  muted = false,
  loop = true,
  onProgress,
  onComplete,
  onError,
  onFatalError
}: VideoPlayerProps & { playbackUrl: string; onFatalError: () => void }) {
  const player = useVideoPlayer(playbackUrl, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
  });
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPoster, setShowPoster] = useState(Boolean(thumbnailUrl));

  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "readyToPlay") {
      setShowPoster(false);
    }
    if (status === "error") {
      onError?.(error?.message ?? "Video playback failed");
      onFatalError();
    }
  });

  useEventListener(player, "playToEnd", () => {
    onComplete?.();
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!isActive || !onProgress) return;
    progressInterval.current = setInterval(() => {
      onProgress(player.currentTime);
    }, 1000);
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isActive, onProgress, player]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {showPoster && thumbnailUrl ? (
        // Poster keeps the frame filled while the stream buffers, so swipes
        // to preloaded neighbours never show a black flash.
        <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
    </View>
  );
}
