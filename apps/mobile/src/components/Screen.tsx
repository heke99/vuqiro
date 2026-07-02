import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing } from "../design/theme";

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  if (!scroll) {
    return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
  }
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, style]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 110 }
});
