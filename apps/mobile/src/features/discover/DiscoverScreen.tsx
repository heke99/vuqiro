import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, radii, spacing } from "../../design/theme";

const categories = ["Music", "Travel", "Tech", "Fitness", "Art", "Food", "Fashion", "Gaming"];

export function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const video of mockVideos) {
      for (const tag of video.hashtags) {
        counts.set(tag, (counts.get(tag) ?? 0) + video.watchCount);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    const creators = mockCreators.filter(
      (creator) =>
        creator.handle.toLowerCase().includes(term) || creator.displayName.toLowerCase().includes(term)
    );
    const videos = mockVideos.filter(
      (video) =>
        video.caption.toLowerCase().includes(term) ||
        video.hashtags.some((tag) => tag.toLowerCase().includes(term))
    );
    return { creators, videos };
  }, [query]);

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
          <Text style={styles.sectionTitle}>Creators</Text>
          {results.creators.length === 0 ? <Text style={styles.empty}>No creators found.</Text> : null}
          {results.creators.map((creator) => (
            <Pressable key={creator.id} onPress={() => router.push(`/creator/${creator.id}`)}>
              <Card style={styles.creatorRow}>
                <Avatar name={creator.displayName} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.creatorName}>
                    {creator.displayName} {creator.isVerified ? "✓" : ""}
                  </Text>
                  <Text style={styles.creatorMeta}>
                    @{creator.handle} • {creator.followerCount.toLocaleString()} followers
                  </Text>
                </View>
              </Card>
            </Pressable>
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
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Trending creators</Text>
          {[...mockCreators]
            .sort((a, b) => b.followerCount - a.followerCount)
            .map((creator) => (
              <Pressable key={creator.id} onPress={() => router.push(`/creator/${creator.id}`)}>
                <Card style={styles.creatorRow}>
                  <Avatar name={creator.displayName} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.creatorName}>
                      {creator.displayName} {creator.isVerified ? "✓" : ""}
                    </Text>
                    <Text style={styles.creatorMeta}>
                      @{creator.handle} • {creator.followerCount.toLocaleString()} followers
                    </Text>
                  </View>
                  {creator.tiersEnabled.length > 1 ? <Badge label="Premium" tone="secondary" /> : null}
                </Card>
              </Pressable>
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
  empty: { color: colors.textMuted, marginBottom: spacing.sm }
});
