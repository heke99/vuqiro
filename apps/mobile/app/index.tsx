import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/features/auth/AuthContext";
import { useOnboardingComplete } from "../src/features/onboarding/onboardingState";
import { colors } from "../src/design/theme";

export default function Index() {
  const { isLoading, isSignedIn, profile } = useAuth();
  const onboardingComplete = useOnboardingComplete();

  if (isLoading || onboardingComplete === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(public)/welcome" />;
  }

  // Suspended/banned/deletion-pending accounts land on the status screen.
  const status = profile?.status ?? "active";
  if (status === "suspended" || status === "banned" || status === "deletion_requested") {
    return <Redirect href="/account-status" />;
  }

  if (!onboardingComplete) {
    return <Redirect href="/(onboarding)/interests" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}
