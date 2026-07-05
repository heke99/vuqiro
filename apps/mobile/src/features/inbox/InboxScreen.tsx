import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mockNotifications } from "@vuqiro/mock-data";
import type { AppNotification, NotificationType } from "@vuqiro/types";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { isDemoMode } from "../../services/data/demoMode";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../design/theme";

const iconForType: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  new_follower: "person-add",
  new_comment: "chatbubble",
  comment_reply: "chatbubbles",
  creator_new_video: "play-circle",
  subscriber_drop: "trending-down",
  subscription_active: "star",
  subscription_cancelled: "star-half",
  coin_received: "server",
  video_unlocked: "lock-open",
  payout_status: "card",
  moderation_warning: "warning",
  system_notice: "information-circle"
};

export function InboxScreen() {
  const [items, setItems] = useState<AppNotification[]>(isDemoMode() ? mockNotifications : []);
  const unread = items.filter((item) => !item.isRead).length;

  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch<{ notifications: AppNotification[]; source: string }>("/notifications");
        if (!cancelled && response.source === "db") {
          setItems(response.notifications);
        }
      } catch {
        // stay on mock data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = () => {
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    if (isApiConfigured()) {
      apiFetch("/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) }).catch(() => {});
    }
  };

  const markRead = (id: string) => {
    setItems((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, isRead: true } : candidate))
    );
    if (isApiConfigured()) {
      apiFetch("/notifications/read", { method: "POST", body: JSON.stringify({ notificationId: id }) }).catch(
        () => {}
      );
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Inbox</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        {unread > 0 ? (
          <Pressable onPress={markAllRead}>
            <Text style={styles.markRead}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.subtitle}>
        {unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You're all caught up"}
      </Text>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => markRead(item.id)}>
          <Card style={[styles.row, !item.isRead && styles.rowUnread]}>
            <View style={styles.iconWrap}>
              <Ionicons name={iconForType[item.type]} size={20} color={item.isRead ? colors.textMuted : colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowBody}>{item.body}</Text>
            </View>
            {!item.isRead ? <View style={styles.dot} /> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  markRead: { color: colors.secondary, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowUnread: { borderColor: colors.primary },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center"
  },
  rowTitle: { color: colors.text, fontWeight: "900", marginBottom: 2 },
  rowBody: { color: colors.textSoft, fontSize: 13, lineHeight: 18 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary }
});
