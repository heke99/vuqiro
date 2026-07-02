import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { colors, radii, spacing } from "../design/theme";

const reasons = ["Harassment", "Hate", "Violence", "Sexual content", "Minor safety", "Spam", "Copyright", "Other"];

export function ReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Report content</Text>
          <Text style={styles.subtitle}>Reports go to Vuqiro moderation. Blocking and removal flows are part of the compliance foundation.</Text>
          <View style={styles.reasons}>{reasons.map((reason) => <Badge key={reason} label={reason} />)}</View>
          <Button label="Submit report (mock)" variant="danger" onPress={onClose} style={{ marginTop: spacing.lg }} />
          <Button label="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }
});
