import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/features/auth/AuthContext";
import { colors, radii, spacing } from "../../src/design/theme";
import { isApiConfigured } from "../../src/services/api/client";
import {
  fetchMessages,
  markConversationRead,
  sendMessage,
  type ChatMessage
} from "../../src/services/data/messagesData";

/** One-to-one conversation screen. */
export default function ConversationScreen() {
  const { id, name, otherProfileId } = useLocalSearchParams<{
    id?: string;
    name?: string;
    otherProfileId?: string;
  }>();
  const router = useRouter();
  const auth = useAuth();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const conversationId = id ?? "";

  const load = useCallback(async () => {
    if (!conversationId || !isApiConfigured()) {
      setMessages([]);
      return;
    }
    try {
      setMessages(await fetchMessages(conversationId));
      void markConversationRead(conversationId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load messages");
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    // Light polling keeps the thread reasonably fresh without sockets.
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !conversationId) return;
    setError(null);
    const optimistic: ChatMessage = {
      id: `local_${Date.now()}`,
      senderProfileId: auth.profile?.id ?? "me",
      body: text,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...(current ?? []), optimistic]);
    setDraft("");
    try {
      await sendMessage(conversationId, text);
      void load();
    } catch (sendError) {
      setMessages((current) => (current ?? []).filter((message) => message.id !== optimistic.id));
      setError(sendError instanceof Error ? sendError.message : "Could not send the message");
    }
  };

  const ownProfileId = auth.profile?.id;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name ?? "Conversation"}
        </Text>
        <Button
          label="Report"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/modals/report",
              params: { targetType: "profile", targetId: otherProfileId ?? "" }
            })
          }
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages === null ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
        {messages !== null && messages.length === 0 ? (
          <Text style={styles.emptyText}>
            {isApiConfigured()
              ? "No messages yet — say hello."
              : "Direct messages activate when the app is connected to the Vuqiro API."}
          </Text>
        ) : null}
        {(messages ?? []).map((message) => {
          const own = message.senderProfileId === ownProfileId;
          return (
            <View key={message.id} style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={own ? styles.bubbleOwnText : styles.bubbleOtherText}>{message.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable style={[styles.send, !draft.trim() && styles.sendDisabled]} onPress={submit}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: { flex: 1, color: colors.text, fontWeight: "900", fontSize: 16, textAlign: "center" },
  messages: { padding: spacing.lg, gap: spacing.sm },
  bubble: { maxWidth: "80%", borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleOwn: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: colors.surfaceElevated },
  bubbleOwnText: { color: colors.white, lineHeight: 20 },
  bubbleOtherText: { color: colors.text, lineHeight: 20 },
  emptyText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl, lineHeight: 20 },
  errorText: { color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 110
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: "center"
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.white, fontWeight: "900" }
});
