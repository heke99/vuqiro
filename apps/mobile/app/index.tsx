import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/features/auth/AuthContext";
import { colors } from "../src/design/theme";

export default function Index() {
  const { isLoading, isSignedIn } = useAuth();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Redirect href={isSignedIn ? "/(tabs)/feed" : "/(public)/welcome"} />;
}
