import { apiFetch, isApiConfigured } from "../api/client";

/** Direct messaging client. Requires the API; there is no demo messaging. */

export type ConversationSummary = {
  id: string;
  other: { profileId: string; handle: string; displayName: string; avatarUrl?: string } | null;
  lastMessage: { body: string; senderProfileId: string | null; createdAt: string } | null;
  unread: boolean;
  lastActivityAt?: string;
};

export type ChatMessage = {
  id: string;
  senderProfileId: string | null;
  body: string;
  createdAt: string;
};

export async function fetchConversations(): Promise<ConversationSummary[]> {
  if (!isApiConfigured()) return [];
  const response = await apiFetch<{ conversations: ConversationSummary[] }>("/messages/conversations");
  return response.conversations;
}

export async function openConversation(target: { creatorId?: string; recipientProfileId?: string }): Promise<string> {
  const response = await apiFetch<{ conversationId: string }>("/messages/conversations", {
    method: "POST",
    body: JSON.stringify(target)
  });
  return response.conversationId;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!isApiConfigured()) return [];
  const response = await apiFetch<{ messages: ChatMessage[] }>(`/messages/conversations/${conversationId}`);
  return response.messages;
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const response = await apiFetch<{ message: ChatMessage }>(`/messages/conversations/${conversationId}`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
  return response.message;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!isApiConfigured()) return;
  try {
    await apiFetch(`/messages/conversations/${conversationId}/read`, { method: "POST" });
  } catch {
    // best-effort
  }
}
