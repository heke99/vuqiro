import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Creator } from "@vuqiro/types";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, radii, spacing } from "../../design/theme";
import { useSocial } from "../social/SocialContext";

const categories = ["Music", "Travel", "Tech", "Fitness", "Art", "Food", "Fashion", "Gaming"];

function CreatorRow({ creator, subtitle }: { creator: Creator; subtitle?: string }) {
  const router = useRouter();
  const social = useSocial();
  const following = social.isFollowing(creator.id);
  return (
    <Pressable onPress={() => router.push(`/creator/${creator.id}`)}>
      <Card style={styles.creatorRow}>
        <Avatar name={creator.displayName} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.creatorName}>
            {creator.displayName} {creator.isVerified ? "✓" : ""}
          </Text>
          <Text style={styles.creatorMeta}>
            {subtitle ?? `@${creator.handle} • ${creator.followerCount.toLocaleString()} followers`}
          </Text>
        </View>
        <Pressable
          style={[styles.followChip, following && styles.followChipOn]}
          onPress={() => social.toggleFollow(creator.id)}
        >
          <Text style={[styles.followChipText, following && styles.followChipTextOn]}>
            {following ? "Following" : "Follow"}
          </Text>
        </Pressable>
      </Card>
    </Pressable>
  );
}

export function DiscoverScreen() {
  const router = useRouter();
  const social = useSocial();
  const [query, setQuery] = useState("");

  const visibleCreators = useMemo(
    () => mockCreators.filter((creator) => !social.isBlocked(creator.id)),
    [social]
  );
  const visibleVideos = useMemo(
    () => mockVideos.filter((video) => !social.isBlocked(video.creatorId)),
    [social]
  );

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const video of visibleVideos) {
      for (const tag of video.hashtags) {
        counts.set(tag, (counts.get(tag) ?? 0) + video.watchCount);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [visibleVideos]);

  const premiumCreators = useMemo(
    () =>
      visibleCreators
        .filter((creator) => creator.monetizationEnabled && creator.tiersEnabled.length >= 2)
        .sort((a, b) => (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0))
        .slice(0, 4),
    [visibleCreators]
  );

  const newCreators = useMemo(
    () =>
      [...visibleCreators]
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 3),
    [visibleCreators]
  );

  const topVideos = useMemo(
    () => [...visibleVideos].sort((a, b) => b.watchCount - a.watchCount).slice(0, 5),
    [visibleVideos]
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^#/, "");
    if (!term) return null;
    const creators = visibleCreators.filter(
      (creator) =>
        creator.handle.toLowerCase().includes(term) ||
        creator.displayName.toLowerCase().includes(term) ||
        (creator.category ?? "").toLowerCase().includes(term)
    );
    const videos = visibleVideos.filter(
      (video) =>
        video.caption.toLowerCase().includes(term) ||
        (video.category ?? "").toLowerCase().includes(term) ||
        video.hashtags.some((tag) => tag.toLowerCase().includes(term))
    );
    const hashtags = trendingHashtags.filter(([tag]) => tag.toLowerCase().includes(term));
    return { creators, videos, hashtags };
  }, [query, visibleCreators, visibleVideos, trendingHashtags]);

  return (
    <Screen>
      <Text style={styles.kicker}>Discover</Text>
      <Text style={styles.title}>Find your next creator</Text>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search creators, videos, hashtags"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
      {results ? (
        <View>
          {results.hashtags.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Hashtags</Text>
              <View style={styles.tagWrap}>
                {results.hashtags.map(([tag]) => (
                  <Pressable key={tag} onPress={() => setQuery(tag)}>
                    <Badge label={`#${tag}`} tone="secondary" />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Text style={styles.sectionTitle}>Creators</Text>
          {results.creators.length === 0 ? <Text style={styles.empty}>No creators found.</Text> : null}
          {results.creators.map((creator) => (
            <CreatorRow key={creator.id} creator={creator} />
          ))}
          <Text style={styles.sectionTitle}>Videos</Text>
          {results.videos.length === 0 ? <Text style={styles.empty}>No videos found.</Text> : null}
          {results.videos.map((video) => (
            <Pressable key={video.id} onPress={() => router.push(`/video/${video.id}`)}>
              <Card style={styles.videoRow}>
                <View style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.videoTitle}>{video.caption}</Text>
                  <Text style={styles.creatorMeta}>{video.watchCount.toLocaleString()} views</Text>
                </View>
                {video.isPremium ? <Badge label="Premium" /> : null}
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Trending creators</Text>
          {[...visibleCreators]
            .sort((a, b) => b.followerCount - a.followerCount)
            .slice(0, 4)
            .map((creator) => (
              <CreatorRow key={creator.id} creator={creator} />
            ))}

          <Text style={styles.sectionTitle}>Trending hashtags</Text>
          <View style={styles.tagWrap}>
            {trendingHashtags.map(([tag]) => (
              <Pressable key={tag} onPress={() => setQuery(tag)}>
                <Badge label={`#${tag}`} tone="secondary" />
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.tagWrap}>
            {categories.map((category) => (
              <Pressable key={category} onPress={() => setQuery(category.toLowerCase())}>
                <Badge label={category} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Premium creators</Text>
          {premiumCreators.map((creator) => (
            <CreatorRow
              key={creator.id}
              creator={creator}
              subtitle={`@${creator.handle} • ${creator.subscriberCount.toLocaleString()} subscribers • ${creator.tiersEnabled.length} tiers`}
            />
          ))}

          <Text style={styles.sectionTitle}>Top videos</Text>
          {topVideos.map((video) => (
            <Pressable key={video.id} onPress={() => router.push(`/video/${video.id}`)}>
              <Card style={styles.videoRow}>
                <View style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.videoTitle}>{video.caption}</Text>
                  <Text style={styles.creatorMeta}>
                    {video.watchCount.toLocaleString()} views • {video.category}
                  </Text>
                </View>
                {video.isPremium ? <Badge label="Premium" /> : null}
              </Card>
            </Pressable>
          ))}

          <Text style={styles.sectionTitle}>New creators</Text>
          {newCreators.map((creator) => (
            <CreatorRow
              key={creator.id}
              creator={creator}
              subtitle={`@${creator.handle} • joined ${creator.createdAt ? new Date(creator.createdAt).toLocaleDateString() : "recently"}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900", marginBottom: spacing.lg },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    marginBottom: spacing.lg
  },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: spacing.lg, marginBottom: spacing.md },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  creatorName: { color: colors.text, fontWeight: "900" },
  creatorMeta: { color: colors.textMuted, fontSize: 12 },
  videoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  thumb: { width: 52, height: 66, borderRadius: 14, backgroundColor: colors.primarySoft },
  videoTitle: { color: colors.text, fontWeight: "800" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  followChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.secondary
  },
  followChipOn: { backgroundColor: colors.secondarySoft },
  followChipText: { color: colors.secondary, fontWeight: "900", fontSize: 12 },
  followChipTextOn: { color: colors.text }
});
