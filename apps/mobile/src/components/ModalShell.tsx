import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, radii, spacing } from "../design/theme";

export function ModalShell({
  title,
  subtitle,
  children,
  closeLabel = "Close"
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.grabber} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
        <Button
          label={closeLabel}
          variant="ghost"
          onPress={() => router.back()}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.sm
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg, lineHeight: 20 }
});
