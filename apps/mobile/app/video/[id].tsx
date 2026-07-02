import { useLocalSearchParams } from "expo-router";
import React from "react";
import { VideoDetailScreen } from "../../src/features/video/VideoDetailScreen";

export default function VideoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VideoDetailScreen videoId={id ?? "video_001"} />;
}
