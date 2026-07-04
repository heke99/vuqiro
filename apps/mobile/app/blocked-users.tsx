import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../src/components/Avatar";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { useSocial } from "../src/features/social/SocialContext";
import { apiFetch, isApiConfigured } from "../src/services/api/client";
import { colors, spacing } from "../src/design/theme";

type BlockedUser = { id: string; profileId: string; handle: string; displayName: string };

export default function BlockedUsersScreen() {
  const social = useSocial();
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured()) {
      setBlocks(
        [...social.blockedUserIds].map((id) => ({
          id,
          profileId: id,
          handle: id.slice(0, 10),
          displayName: `Blocked user ${id.slice(-4)}`
        }))
      );
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ blocks: BlockedUser[] }>("/me/blocks");
      setBlocks(response.blocks);
    } catch {
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [social.blockedUserIds]);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (profileId: string) => {
    setBlocks((current) => current.filter((block) => block.profileId !== profileId));
    social.toggleBlock(profileId);
    void load();
  };

  return (
    <Screen>
      <Text style={styles.kicker}>Safety</Text>
      <Text style={styles.title}>Blocked accounts</Text>
      <Text style={styles.copy}>
        Blocked accounts can't see your content, comment on your videos or appear in your feed.
      </Text>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
      {!loading && blocks.length === 0 ? <Text style={styles.empty}>You haven't blocked anyone.</Text> : null}
      {blocks.map((block) => (
        <Card key={block.id} style={styles.row}>
          <View style={styles.rowLeft}>
            <Avatar name={block.displayName} size={38} />
            <View>
              <Text style={styles.name}>{block.displayName}</Text>
              <Text style={styles.handle}>@{block.handle}</Text>
            </View>
          </View>
          <Button label="Unblock" variant="ghost" onPress={() => unblock(block.profileId)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  copy: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.xl },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.text, fontWeight: "800" },
  handle: { color: colors.textMuted, fontSize: 12 }
});
