import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/design/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="creator/[id]" />
        <Stack.Screen name="video/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="legal/terms" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/community-guidelines" />
        <Stack.Screen name="legal/creator-terms" />
        <Stack.Screen name="legal/payout-terms" />
        <Stack.Screen name="modals/subscribe" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/coins" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/report" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/comment-sheet" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/share-sheet" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/locked-content" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
