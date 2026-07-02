import { Stack } from "expo-router";
import React from "react";
import { colors } from "../../src/design/theme";

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    />
  );
}
