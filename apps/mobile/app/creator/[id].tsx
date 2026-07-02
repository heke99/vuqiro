import { useLocalSearchParams } from "expo-router";
import React from "react";
import { CreatorProfileScreen } from "../../src/features/creator/CreatorProfileScreen";

export default function CreatorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CreatorProfileScreen creatorId={id ?? "creator_001"} />;
}
