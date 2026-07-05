import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "../src/components/Button";
import { captureError } from "../src/services/monitoring";
import { AuthProvider } from "../src/features/auth/AuthContext";
import { SocialProvider } from "../src/features/social/SocialContext";
import { startEventFlusher } from "../src/features/video/videoEvents";
import { apiFetch, isApiConfigured } from "../src/services/api/client";
import { colors } from "../src/design/theme";

/**
 * Root error boundary (Expo Router convention): the last line of defense —
 * errors are reported to monitoring and the user gets a recoverable screen
 * instead of a crash.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    captureError(error, "root-error-boundary");
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.copy}>
        The app hit an unexpected error. Your data is safe — try again.
      </Text>
      <Button label="Try again" onPress={retry} />
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12
  },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  copy: { color: colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 8 }
});

export default function RootLayout() {
  useEffect(() => {
    if (!isApiConfigured()) return;
    return startEventFlusher(async (events) => {
      await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify({
          events: events.map((event) => ({
            name: event.name,
            videoId: event.videoId,
            creatorId: event.creatorId,
            value: event.value,
            at: event.at
          }))
        })
      });
    });
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocialProvider>
        <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="creator/[id]" />
        <Stack.Screen name="video/[id]" />
        <Stack.Screen name="hashtag/[tag]" />
        <Stack.Screen name="saved-videos" />
        <Stack.Screen name="liked-videos" />
        <Stack.Screen name="following-list" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="account-status" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="blocked-users" />
        <Stack.Screen name="privacy-settings" />
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
        <Stack.Screen name="modals/report-ad" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/video-options" options={{ presentation: "modal" }} />
          </Stack>
        </SocialProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
