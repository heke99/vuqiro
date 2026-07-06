import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mockComments } from "@vuqiro/mock-data";
import type { Comment } from "@vuqiro/types";
import { Avatar } from "../../src/components/Avatar";
import { Badge } from "../../src/components/Badge";
import { ModalShell } from "../../src/components/ModalShell";
import { useAuth } from "../../src/features/auth/AuthContext";
import { useSocial } from "../../src/features/social/SocialContext";
import { trackEvent } from "../../src/features/video/videoEvents";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { isDemoContentAllowed } from "../../src/services/data/demoMode";
import { colors, radii, spacing } from "../../src/design/theme";

type CommentRowDto = {
  id: string;
  video_id: string;
  author_id: string;
  parent_comment_id?: string | null;
  text: string;
  like_count: number;
  reply_count: number;
  created_at: string;
  profiles?: { handle?: string; display_name?: string } | null;
};

function dtoToComment(dto: CommentRowDto): Comment {
  return {
    id: dto.id,
    videoId: dto.video_id,
    authorId: dto.author_id,
    authorHandle: dto.profiles?.handle ?? "user",
    authorDisplayName: dto.profiles?.display_name ?? dto.profiles?.handle ?? "User",
    isCreator: false,
    isSubscriber: false,
    parentCommentId: dto.parent_comment_id ?? undefined,
    text: dto.text,
    likeCount: dto.like_count,
    replyCount: dto.reply_count,
    createdAt: dto.created_at
  };
}

function CommentRow({
  comment,
  replies,
  ownProfileId,
  onDelete,
  onReply
}: {
  comment: Comment;
  replies: Comment[];
  ownProfileId?: string;
  onDelete: (commentId: string) => void;
  onReply: (comment: Comment) => void;
}) {
  const router = useRouter();
  const social = useSocial();
  const [liked, setLiked] = useState(false);

  const toggleLike = () => {
    setLiked((value) => !value);
    if (isApiConfigured()) {
      apiFetch(`/comments/${comment.id}/like`, { method: "POST" }).catch(() => setLiked((value) => !value));
    }
  };

  const isOwn = ownProfileId && comment.authorId === ownProfileId;

  return (
    <View style={styles.commentBlock}>
      <View style={styles.commentRow}>
        <Avatar name={comment.authorDisplayName} size={34} />
        <View style={{ flex: 1 }}>
          <View style={styles.authorRow}>
            <Text style={styles.author}>{comment.authorDisplayName}</Text>
            {comment.isCreator ? <Badge label="Creator" tone="secondary" /> : null}
            {!comment.isCreator && comment.isSubscriber ? <Badge label="Subscriber" /> : null}
          </View>
          <Text style={styles.text}>{comment.text}</Text>
          <View style={styles.actions}>
            <Pressable onPress={toggleLike}>
              <Text style={[styles.action, liked && styles.actionActive]}>
                {liked ? "Liked" : "Like"} · {comment.likeCount + (liked ? 1 : 0)}
              </Text>
            </Pressable>
            <Pressable onPress={() => onReply(comment)}>
              <Text style={styles.action}>Reply{comment.replyCount > 0 ? ` (${comment.replyCount})` : ""}</Text>
            </Pressable>
            {isOwn ? (
              <Pressable onPress={() => onDelete(comment.id)}>
                <Text style={[styles.action, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/modals/report",
                      params: { targetType: "comment", targetId: comment.id }
                    })
                  }
                >
                  <Text style={styles.action}>Report</Text>
                </Pressable>
                <Pressable onPress={() => social.toggleBlock(comment.authorId)}>
                  <Text style={styles.action}>Block</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
      {replies.map((reply) => (
        <View key={reply.id} style={[styles.commentRow, styles.replyRow]}>
          <Avatar name={reply.authorDisplayName} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={styles.author}>
              {reply.authorDisplayName}
              {reply.isCreator ? "  · Creator" : ""}
            </Text>
            <Text style={styles.text}>{reply.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function CommentSheet() {
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const social = useSocial();
  const auth = useAuth();
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      const id = videoId ?? "video_001";
      if (!isApiConfigured()) {
        setComments(isDemoContentAllowed() ? mockComments.filter((comment) => comment.videoId === id) : []);
        setIsLive(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        const response = await apiFetch<{
          comments: (CommentRowDto | Comment)[];
          nextCursor?: string | null;
          source: string;
        }>(`/videos/${id}/comments${query}`);
        const mapped = response.comments.map((row) =>
          "video_id" in row ? dtoToComment(row as CommentRowDto) : (row as Comment)
        );
        setComments((current) => {
          if (!cursor) return mapped;
          const seen = new Set(current.map((comment) => comment.id));
          return [...current, ...mapped.filter((comment) => !seen.has(comment.id))];
        });
        setNextCursor(response.nextCursor ?? null);
        setIsLive(response.source === "db");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load comments");
        if (!cursor && isDemoContentAllowed()) {
          setComments(mockComments.filter((comment) => comment.videoId === id));
        }
      } finally {
        setLoading(false);
      }
    },
    [videoId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const { topLevel, repliesByParent } = useMemo(() => {
    const visible = comments.filter((comment) => !social.isBlocked(comment.authorId));
    const topLevelComments = visible.filter((comment) => !comment.parentCommentId);
    const replyMap = new Map<string, Comment[]>();
    for (const comment of visible) {
      if (comment.parentCommentId) {
        replyMap.set(comment.parentCommentId, [...(replyMap.get(comment.parentCommentId) ?? []), comment]);
      }
    }
    return { topLevel: topLevelComments, repliesByParent: replyMap };
  }, [comments, social]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const id = videoId ?? "video_001";
    const parent = replyTo;
    trackEvent("comment_submit", { videoId: id });
    // Optimistic insert; reconciled on reload.
    const optimistic: Comment = {
      id: `local_${Date.now()}`,
      videoId: id,
      authorId: auth.profile?.id ?? "user_me",
      authorHandle: auth.profile?.handle ?? "you",
      authorDisplayName: "You",
      isCreator: false,
      isSubscriber: false,
      parentCommentId: parent?.id,
      text,
      likeCount: 0,
      replyCount: 0,
      createdAt: new Date().toISOString()
    };
    setComments((current) => (parent ? [...current, optimistic] : [optimistic, ...current]));
    setDraft("");
    setReplyTo(null);
    if (isApiConfigured()) {
      try {
        if (parent && !parent.id.startsWith("local_")) {
          await apiFetch(`/comments/${parent.id}/replies`, { method: "POST", body: JSON.stringify({ text }) });
        } else {
          await apiFetch(`/videos/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) });
        }
        void load();
      } catch (submitError) {
        setComments((current) => current.filter((comment) => comment.id !== optimistic.id));
        setError(submitError instanceof Error ? submitError.message : "Could not post the comment");
      }
    }
  };

  const deleteComment = async (commentId: string) => {
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    if (isApiConfigured() && !commentId.startsWith("local_")) {
      apiFetch(`/comments/${commentId}`, { method: "DELETE" }).catch(() => void load());
    }
  };

  return (
    <ModalShell title="Comments" subtitle={`${topLevel.length} comments${isLive ? "" : " · demo data"}`}>
      {replyTo ? (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText} numberOfLines={1}>
            Replying to {replyTo.authorDisplayName}: “{replyTo.text.slice(0, 60)}”
          </Text>
          <Pressable onPress={() => setReplyTo(null)}>
            <Text style={styles.replyBannerCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={replyTo ? "Add a reply…" : "Add a comment…"}
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={[styles.send, !draft.trim() && styles.sendDisabled]} onPress={submit}>
          <Text style={styles.sendText}>Post</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && comments.length === 0 ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
      {!loading && topLevel.length === 0 ? (
        <Text style={styles.emptyText}>No comments yet — start the conversation.</Text>
      ) : null}
      {topLevel.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          replies={repliesByParent.get(comment.id) ?? []}
          ownProfileId={auth.profile?.id}
          onDelete={deleteComment}
          onReply={setReplyTo}
        />
      ))}
      {nextCursor ? (
        <Pressable style={styles.loadMore} onPress={() => load(nextCursor)} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.loadMoreText}>Load more comments</Text>
          )}
        </Pressable>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: "center"
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.white, fontWeight: "900" },
  commentBlock: { marginBottom: spacing.md },
  commentRow: { flexDirection: "row", gap: spacing.md },
  replyRow: { marginLeft: 44, marginTop: spacing.sm },
  author: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  text: { color: colors.text, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  action: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  actionActive: { color: colors.secondary },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
  emptyText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm
  },
  replyBannerText: { flex: 1, color: colors.textSoft, fontSize: 12 },
  replyBannerCancel: { color: colors.secondary, fontWeight: "900", fontSize: 12 },
  loadMore: { alignItems: "center", paddingVertical: spacing.lg },
  loadMoreText: { color: colors.secondary, fontWeight: "900" }
});
