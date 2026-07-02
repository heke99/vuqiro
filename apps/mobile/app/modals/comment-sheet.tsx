import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mockComments } from "@vuqiro/mock-data";
import type { Comment } from "@vuqiro/types";
import { Avatar } from "../../src/components/Avatar";
import { Badge } from "../../src/components/Badge";
import { ModalShell } from "../../src/components/ModalShell";
import { useSocial } from "../../src/features/social/SocialContext";
import { trackEvent } from "../../src/features/video/videoEvents";
import { colors, radii, spacing } from "../../src/design/theme";

function CommentRow({ comment, replies }: { comment: Comment; replies: Comment[] }) {
  const router = useRouter();
  const social = useSocial();
  const [liked, setLiked] = useState(false);
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
            <Pressable onPress={() => setLiked((value) => !value)}>
              <Text style={[styles.action, liked && styles.actionActive]}>
                {liked ? "Liked" : "Like"} · {comment.likeCount + (liked ? 1 : 0)}
              </Text>
            </Pressable>
            <Text style={styles.action}>Reply{comment.replyCount > 0 ? ` (${comment.replyCount})` : ""}</Text>
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
  const [draft, setDraft] = useState("");
  const [localComments, setLocalComments] = useState<Comment[]>([]);

  const { topLevel, repliesByParent } = useMemo(() => {
    const forVideo = mockComments.filter(
      (comment) => comment.videoId === (videoId ?? "video_001") && !social.isBlocked(comment.authorId)
    );
    const topLevelComments = forVideo.filter((comment) => !comment.parentCommentId);
    const replyMap = new Map<string, Comment[]>();
    for (const comment of forVideo) {
      if (comment.parentCommentId) {
        replyMap.set(comment.parentCommentId, [
          ...(replyMap.get(comment.parentCommentId) ?? []),
          comment
        ]);
      }
    }
    return { topLevel: topLevelComments, repliesByParent: replyMap };
  }, [videoId, social]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    trackEvent("comment_submit", { videoId: videoId ?? "video_001" });
    setLocalComments((current) => [
      {
        id: `local_${Date.now()}`,
        videoId: videoId ?? "video_001",
        authorId: "user_me",
        authorHandle: "vuqiro_user",
        authorDisplayName: "You",
        isCreator: false,
        isSubscriber: false,
        text,
        likeCount: 0,
        replyCount: 0,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    setDraft("");
  };

  return (
    <ModalShell title="Comments" subtitle={`${topLevel.length + localComments.length} comments`}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={[styles.send, !draft.trim() && styles.sendDisabled]} onPress={submit}>
          <Text style={styles.sendText}>Post</Text>
        </Pressable>
      </View>
      {localComments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} replies={[]} />
      ))}
      {topLevel.map((comment) => (
        <CommentRow key={comment.id} comment={comment} replies={repliesByParent.get(comment.id) ?? []} />
      ))}
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
  actionActive: { color: colors.secondary }
});
