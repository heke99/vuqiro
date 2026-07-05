import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { colors, radii, spacing } from "../../design/theme";
import { isApiConfigured } from "../../services/api/client";
import {
  clearRecentSearches,
  fetchCategories,
  fetchRecentSearches,
  fetchTrending,
  searchAll,
  type DiscoverCategory,
  type DiscoverCreator,
  type DiscoverVideo,
  type SearchResults,
  type TrendingData
} from "../../services/data/discoverData";
import { useSocial } from "../social/SocialContext";
import { trackEvent } from "../video/videoEvents";

function CreatorRow({ creator, subtitle }: { creator: DiscoverCreator; subtitle?: string }) {
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

function VideoRow({ video }: { video: DiscoverVideo }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/video/${video.id}`)}>
      <Card style={styles.videoRow}>
        {video.thumbnailUrl ? (
          <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumb} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {video.caption}
          </Text>
          <Text style={styles.creatorMeta}>
            {video.watchCount.toLocaleString()} views{video.category ? ` • ${video.category}` : ""}
          </Text>
        </View>
        {video.isPremium ? <Badge label="Premium" /> : null}
      </Card>
    </Pressable>
  );
}

export function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [categories, setCategories] = useState<DiscoverCategory[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTrending(), fetchCategories(), fetchRecentSearches()])
      .then(([trendingData, categoryData, searches]) => {
        if (!active) return;
        setTrending(trendingData);
        setCategories(categoryData);
        setRecentSearches(searches);
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError("Could not load discovery data. Pull to refresh or try again later.");
      });
    return () => {
      active = false;
    };
  }, []);

  // Debounced live search.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      trackEvent("search_performed", { value: term.length });
      const searchResults = await searchAll(term);
      setResults(searchResults);
      setSearching(false);
      if (isApiConfigured()) {
        setRecentSearches((current) => [term, ...current.filter((entry) => entry !== term)].slice(0, 10));
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const onClearHistory = useCallback(() => {
    setRecentSearches([]);
    void clearRecentSearches();
  }, []);

  const emptyDiscover = useMemo(
    () =>
      trending !== null &&
      trending.trendingCreators.length === 0 &&
      trending.topVideos.length === 0 &&
      trending.trendingHashtags.length === 0,
    [trending]
  );

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

      {loadError && !results ? <Text style={styles.errorText}>{loadError}</Text> : null}

      {!results && recentSearches.length > 0 ? (
        <>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <Pressable onPress={onClearHistory}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.tagWrap}>
            {recentSearches.map((entry) => (
              <Pressable key={entry} onPress={() => setQuery(entry)}>
                <Badge label={entry} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {searching ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} /> : null}

      {results && !searching ? (
        <View>
          {results.hashtags.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Hashtags</Text>
              <View style={styles.tagWrap}>
                {results.hashtags.map((tag) => (
                  <Pressable key={tag} onPress={() => router.push(`/hashtag/${tag}`)}>
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
            <VideoRow key={video.id} video={video} />
          ))}
        </View>
      ) : null}

      {!results && !searching ? (
        trending === null ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : emptyDiscover ? (
          <Card style={{ alignItems: "center", gap: spacing.sm, padding: spacing.xl, marginTop: spacing.lg }}>
            <Text style={styles.emptyTitle}>Nothing trending yet</Text>
            <Text style={styles.empty}>Check back soon — trends update as people watch and post.</Text>
          </Card>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Trending creators</Text>
            {trending.trendingCreators.map((creator) => (
              <CreatorRow key={creator.id} creator={creator} />
            ))}

            {trending.trendingHashtags.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Trending hashtags</Text>
                <View style={styles.tagWrap}>
                  {trending.trendingHashtags.map((tag) => (
                    <Pressable key={tag} onPress={() => router.push(`/hashtag/${tag}`)}>
                      <Badge label={`#${tag}`} tone="secondary" />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.tagWrap}>
              {categories.map((category) => (
                <Pressable key={category.id} onPress={() => setQuery(category.label.toLowerCase())}>
                  <Badge label={category.label} />
                </Pressable>
              ))}
            </View>

            {trending.premiumCreators.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Premium creators</Text>
                {trending.premiumCreators.map((creator) => (
                  <CreatorRow
                    key={creator.id}
                    creator={creator}
                    subtitle={`@${creator.handle} • ${creator.subscriberCount.toLocaleString()} subscribers`}
                  />
                ))}
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Top videos</Text>
            {trending.topVideos.map((video) => (
              <VideoRow key={video.id} video={video} />
            ))}

            {trending.newCreators.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>New creators</Text>
                {trending.newCreators.map((creator) => (
                  <CreatorRow
                    key={creator.id}
                    creator={creator}
                    subtitle={`@${creator.handle} • joined ${creator.createdAt ? new Date(creator.createdAt).toLocaleDateString() : "recently"}`}
                  />
                ))}
              </>
            ) : null}
          </View>
        )
      ) : null}
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
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clearText: { color: colors.secondary, fontWeight: "800", fontSize: 12, marginTop: spacing.lg },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  creatorName: { color: colors.text, fontWeight: "900" },
  creatorMeta: { color: colors.textMuted, fontSize: 12 },
  videoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  thumb: { width: 52, height: 66, borderRadius: 14, backgroundColor: colors.primarySoft },
  videoTitle: { color: colors.text, fontWeight: "800" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm, textAlign: "center" },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  errorText: { color: colors.danger, marginBottom: spacing.md },
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
