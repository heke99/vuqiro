import { Hono } from "hono";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { notifyProfile } from "../lib/notify";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

/**
 * Direct messaging over the existing conversations/conversation_members/
 * messages tables. Rules:
 *  - blocks (either direction) prevent opening conversations and sending;
 *  - the recipient's who_can_message safety setting is enforced server-side
 *    (source of truth: user_safety_settings.who_can_message);
 *  - messages are reportable (target_type "message") and rate limited.
 */
export const messageRoutes = new Hono<AppEnv>();

messageRoutes.use("*", attachUser);

const idParam = z.string().min(1).max(64);

type MessagePermission = { allowed: boolean; reason?: string };

async function checkMessagePermission(senderId: string, recipientId: string): Promise<MessagePermission> {
  const db = getServiceDb()!;
  if (senderId === recipientId) return { allowed: false, reason: "You cannot message yourself." };

  const [{ data: recipient }, { data: blocks }] = await Promise.all([
    db.from("profiles").select("id, status").eq("id", recipientId).maybeSingle(),
    db
      .from("blocks")
      .select("id")
      .or(
        `and(blocker_id.eq.${senderId},blocked_profile_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_profile_id.eq.${senderId})`
      )
      .limit(1)
  ]);
  if (!recipient || recipient.status !== "active") {
    return { allowed: false, reason: "This account cannot receive messages." };
  }
  if ((blocks ?? []).length > 0) {
    return { allowed: false, reason: "Messaging is not available for this account." };
  }

  const { data: safety } = await db
    .from("user_safety_settings")
    .select("who_can_message")
    .eq("profile_id", recipientId)
    .maybeSingle();
  const whoCanMessage = safety?.who_can_message ?? "followers";
  if (whoCanMessage === "no_one") {
    return { allowed: false, reason: "This account does not accept messages." };
  }
  if (whoCanMessage === "followers") {
    // The sender must follow the recipient's creator account.
    const { data: recipientCreator } = await db
      .from("creators")
      .select("id")
      .eq("profile_id", recipientId)
      .maybeSingle();
    if (!recipientCreator) {
      return { allowed: false, reason: "This account only accepts messages from followers." };
    }
    const { data: follow } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", senderId)
      .eq("creator_id", recipientCreator.id)
      .maybeSingle();
    if (!follow) {
      return { allowed: false, reason: "Follow this creator to send them a message." };
    }
  }
  return { allowed: true };
}

async function findDirectConversation(profileA: string, profileB: string): Promise<string | null> {
  const db = getServiceDb()!;
  const { data: aMemberships } = await db
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", profileA)
    .limit(500);
  const candidateIds = (aMemberships ?? []).map((row) => row.conversation_id);
  if (candidateIds.length === 0) return null;
  const { data: shared } = await db
    .from("conversation_members")
    .select("conversation_id, conversations!inner (type)")
    .eq("profile_id", profileB)
    .in("conversation_id", candidateIds)
    .limit(50);
  const direct = (shared ?? []).find(
    (row) => (row.conversations as unknown as { type: string } | null)?.type === "direct"
  );
  return direct?.conversation_id ?? null;
}

async function requireMembership(conversationId: string, profileId: string): Promise<void> {
  const db = getServiceDb()!;
  const { data: membership } = await db
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!membership) throw notFound("Conversation not found");
}

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------

messageRoutes.get("/conversations", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ conversations: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: memberships, error } = await db
    .from("conversation_members")
    .select("conversation_id, last_read_at, conversations!inner (id, type, last_message_at, created_at)")
    .eq("profile_id", profile.id)
    .limit(100);
  if (error) throw badRequest(error.message);

  const rows = (memberships ?? []) as unknown as {
    conversation_id: string;
    last_read_at: string | null;
    conversations: { id: string; type: string; last_message_at: string | null; created_at: string };
  }[];
  const directRows = rows.filter((row) => row.conversations.type === "direct");
  if (directRows.length === 0) return c.json({ conversations: [], source: "db" });

  const conversationIds = directRows.map((row) => row.conversation_id);
  const [{ data: others }, { data: lastMessages }] = await Promise.all([
    db
      .from("conversation_members")
      .select("conversation_id, profile_id, profiles (handle, display_name, avatar_url)")
      .in("conversation_id", conversationIds)
      .neq("profile_id", profile.id),
    db
      .from("messages")
      .select("conversation_id, body, sender_profile_id, moderation_status, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const otherByConversation = new Map(
    (others ?? []).map((row) => [
      row.conversation_id,
      {
        profileId: row.profile_id,
        handle: (row.profiles as unknown as { handle?: string } | null)?.handle ?? "unknown",
        displayName:
          (row.profiles as unknown as { display_name?: string } | null)?.display_name ?? "Unknown",
        avatarUrl: (row.profiles as unknown as { avatar_url?: string | null } | null)?.avatar_url ?? undefined
      }
    ])
  );
  const lastByConversation = new Map<string, { body: string; senderProfileId: string | null; createdAt: string }>();
  for (const message of lastMessages ?? []) {
    if (!lastByConversation.has(message.conversation_id)) {
      lastByConversation.set(message.conversation_id, {
        body: message.moderation_status === "removed" ? "(removed)" : message.body,
        senderProfileId: message.sender_profile_id,
        createdAt: message.created_at
      });
    }
  }

  const conversations = directRows
    .map((row) => {
      const last = lastByConversation.get(row.conversation_id);
      return {
        id: row.conversation_id,
        other: otherByConversation.get(row.conversation_id) ?? null,
        lastMessage: last ?? null,
        unread: Boolean(
          last &&
            last.senderProfileId !== profile.id &&
            (!row.last_read_at || last.createdAt > row.last_read_at)
        ),
        lastActivityAt: row.conversations.last_message_at ?? row.conversations.created_at
      };
    })
    .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));

  return c.json({ conversations, source: "db" });
});

// ---------------------------------------------------------------------------
// Open (or create) a direct conversation
// ---------------------------------------------------------------------------

const openBody = z
  .object({
    recipientProfileId: z.string().min(1).max(64).optional(),
    creatorId: z.string().min(1).max(64).optional()
  })
  .refine((body) => body.recipientProfileId || body.creatorId, {
    message: "recipientProfileId or creatorId is required"
  });

messageRoutes.post("/conversations", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`conversation-open:${profile.id}`, 30, 3_600_000);
  const body = openBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ conversationId: `mock_convo_${Date.now()}`, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  let recipientProfileId = body.recipientProfileId;
  if (!recipientProfileId && body.creatorId) {
    const { data: creator } = await db.from("creators").select("profile_id").eq("id", body.creatorId).maybeSingle();
    if (!creator) throw notFound("Creator not found");
    recipientProfileId = creator.profile_id;
  }
  if (!recipientProfileId) throw badRequest("No recipient");

  const permission = await checkMessagePermission(profile.id, recipientProfileId);
  if (!permission.allowed) throw forbidden(permission.reason ?? "Messaging not allowed");

  const existing = await findDirectConversation(profile.id, recipientProfileId);
  if (existing) return c.json({ conversationId: existing, source: "db" });

  const { data: conversation, error } = await db
    .from("conversations")
    .insert({ type: "direct" })
    .select("id")
    .single();
  if (error) throw badRequest(error.message);
  const { error: memberError } = await db.from("conversation_members").insert([
    { conversation_id: conversation.id, profile_id: profile.id },
    { conversation_id: conversation.id, profile_id: recipientProfileId }
  ]);
  if (memberError) throw badRequest(memberError.message);
  return c.json({ conversationId: conversation.id, source: "db" }, 201);
});

// ---------------------------------------------------------------------------
// Messages in a conversation
// ---------------------------------------------------------------------------

messageRoutes.get("/conversations/:id", requireUser, async (c) => {
  const conversationId = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ messages: [], source: "mock" });
  }
  await requireMembership(conversationId, profile.id);

  const db = getServiceDb()!;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 100);
  const before = c.req.query("before");
  let query = db
    .from("messages")
    .select("id, sender_profile_id, body, moderation_status, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);

  const messages = (data ?? [])
    .map((row) => ({
      id: row.id,
      senderProfileId: row.sender_profile_id,
      body: row.moderation_status === "removed" ? "(removed by moderation)" : row.body,
      createdAt: row.created_at
    }))
    .reverse();
  return c.json({ messages, source: "db" });
});

const sendBody = z.object({ body: z.string().trim().min(1).max(4000) });

messageRoutes.post("/conversations/:id", requireUser, async (c) => {
  const conversationId = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`message-send:${profile.id}`, 60, 60_000);
  const body = sendBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ message: { id: `mock_msg_${Date.now()}`, body: body.body }, source: "mock" }, 201);
  }
  await requireMembership(conversationId, profile.id);

  const db = getServiceDb()!;
  // Re-check blocks/settings against the other member on every send.
  const { data: otherMember } = await db
    .from("conversation_members")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .neq("profile_id", profile.id)
    .maybeSingle();
  if (otherMember) {
    const permission = await checkMessagePermission(profile.id, otherMember.profile_id);
    if (!permission.allowed) throw forbidden(permission.reason ?? "Messaging not allowed");
  }

  const { data: message, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_profile_id: profile.id, body: body.body })
    .select("id, sender_profile_id, body, created_at")
    .single();
  if (error) throw badRequest(error.message);

  const now = new Date().toISOString();
  await Promise.all([
    db.from("conversations").update({ last_message_at: now }).eq("id", conversationId),
    db
      .from("conversation_members")
      .update({ last_read_at: now })
      .eq("conversation_id", conversationId)
      .eq("profile_id", profile.id)
  ]);

  if (otherMember) {
    await notifyProfile({
      profileId: otherMember.profile_id,
      type: "new_message",
      title: "New message",
      body: `@${profile.handle}: ${body.body.slice(0, 80)}`,
      relatedProfileId: profile.id
    });
  }
  return c.json({ message, source: "db" }, 201);
});

messageRoutes.post("/conversations/:id/read", requireUser, async (c) => {
  const conversationId = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ read: true, source: "mock" });
  }
  await requireMembership(conversationId, profile.id);
  const db = getServiceDb()!;
  const { error } = await db
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", profile.id);
  if (error) throw badRequest(error.message);
  return c.json({ read: true, source: "db" });
});
