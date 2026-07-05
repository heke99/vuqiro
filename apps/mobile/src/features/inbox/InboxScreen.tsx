import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mockNotifications } from "@vuqiro/mock-data";
import type { AppNotification, NotificationType } from "@vuqiro/types";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { isDemoMode } from "../../services/data/demoMode";
import { fetchConversations, type ConversationSummary } from "../../services/data/messagesData";
import { Avatar } from "../../components/Avatar";
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
  system_notice: "information-circle",
  new_message: "mail"
};

export function InboxScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"notifications" | "messages">("notifications");
  const [items, setItems] = useState<AppNotification[]>(isDemoMode() ? mockNotifications : []);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const unread = items.filter((item) => !item.isRead).length;
  const unreadMessages = (conversations ?? []).filter((conversation) => conversation.unread).length;

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await fetchConversations());
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    if (tab === "messages") void loadConversations();
  }, [tab, loadConversations]);

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

  /** Deep-link a notification to the content it is about. */
  const openNotification = (item: AppNotification) => {
    markRead(item.id);
    if (item.type === "new_message") {
      setTab("messages");
      return;
    }
    if (item.relatedVideoId) {
      router.push(`/video/${item.relatedVideoId}`);
      return;
    }
    if (item.type === "payout_status") {
      router.push("/studio/payouts");
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Inbox</Text>
          <Text style={styles.title}>{tab === "notifications" ? "Notifications" : "Messages"}</Text>
        </View>
        {tab === "notifications" && unread > 0 ? (
          <Pressable onPress={markAllRead}>
            <Text style={styles.markRead}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "notifications" && styles.tabActive]}
          onPress={() => setTab("notifications")}
        >
          <Text style={[styles.tabText, tab === "notifications" && styles.tabTextActive]}>
            Notifications{unread > 0 ? ` (${unread})` : ""}
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "messages" && styles.tabActive]} onPress={() => setTab("messages")}>
          <Text style={[styles.tabText, tab === "messages" && styles.tabTextActive]}>
            Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ""}
          </Text>
        </Pressable>
      </View>

      {tab === "notifications" ? (
        <>
          <Text style={styles.subtitle}>
            {unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You're all caught up"}
          </Text>
          {items.length === 0 ? <Text style={styles.emptyText}>No notifications yet.</Text> : null}
          {items.map((item) => (
            <Pressable key={item.id} onPress={() => openNotification(item)}>
              <Card style={[styles.row, !item.isRead && styles.rowUnread]}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={iconForType[item.type]}
                    size={20}
                    color={item.isRead ? colors.textMuted : colors.secondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowBody}>{item.body}</Text>
                </View>
                {!item.isRead ? <View style={styles.dot} /> : null}
              </Card>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          {!isApiConfigured() ? (
            <Text style={styles.emptyText}>Direct messages activate when the app is connected to the Vuqiro API.</Text>
          ) : conversations === null ? (
            <Text style={styles.emptyText}>Loading conversations…</Text>
          ) : conversations.length === 0 ? (
            <Text style={styles.emptyText}>
              No conversations yet. Open a creator profile and tap Message to start one.
            </Text>
          ) : (
            conversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={() =>
                  router.push({
                    pathname: "/messages/[id]",
                    params: {
                      id: conversation.id,
                      name: conversation.other?.displayName ?? "Conversation",
                      otherProfileId: conversation.other?.profileId ?? ""
                    }
                  })
                }
              >
                <Card style={[styles.row, conversation.unread && styles.rowUnread]}>
                  <Avatar name={conversation.other?.displayName ?? "?"} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{conversation.other?.displayName ?? "Conversation"}</Text>
                    <Text style={styles.rowBody} numberOfLines={1}>
                      {conversation.lastMessage?.body ?? "Start the conversation"}
                    </Text>
                  </View>
                  {conversation.unread ? <View style={styles.dot} /> : null}
                </Card>
              </Pressable>
            ))
          )}
        </>
      )}
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
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary },
  tabs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  tabActive: { borderColor: colors.secondary, backgroundColor: colors.surfaceElevated },
  tabText: { color: colors.textMuted, fontWeight: "800", fontSize: 13 },
  tabTextActive: { color: colors.text },
  emptyText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl, lineHeight: 20 }
});
