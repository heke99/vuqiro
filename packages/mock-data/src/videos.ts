import type { Video, Visibility } from "@vuqiro/types";

type VideoSeed = [
  id: string,
  creatorId: string,
  caption: string,
  hashtags: string[],
  category: string,
  visibility: Visibility,
  likeCount: number,
  watchCount: number,
  safetyScore: number,
  extras?: Partial<Video>
];

const seeds: VideoSeed[] = [
  ["video_001", "creator_001", "A quick moment from tonight’s session.", ["music", "studio", "creator"], "Music", "public", 12400, 210000, 94],
  ["video_002", "creator_002", "City lights, fast cuts, no filter.", ["travel", "night", "cinematic"], "Travel", "unlock_with_coins", 7900, 84000, 91, { coinUnlockPrice: 100, isPremium: true }],
  ["video_003", "creator_003", "The simplest way to structure a creator app MVP.", ["build", "startup", "tech"], "Tech", "subscribers_only", 2200, 22000, 97, { requiredTier: "support", isPremium: true }],
  ["video_004", "creator_004", "3-ingredient street tacos in 60 seconds.", ["food", "recipe", "fast"], "Food", "public", 31200, 480000, 96],
  ["video_005", "creator_004", "Late-night market food tour, part 2.", ["food", "travel", "street"], "Food", "public", 18600, 290000, 95],
  ["video_006", "creator_005", "Full-body warmup you can do anywhere.", ["fitness", "training", "mobility"], "Fitness", "public", 14100, 220000, 98],
  ["video_007", "creator_005", "My exact weekly programming.", ["fitness", "plan", "calisthenics"], "Fitness", "subscribers_only", 3900, 41000, 97, { requiredTier: "plus", isPremium: true }],
  ["video_008", "creator_006", "Painting light: a 40-hour piece in 60 seconds.", ["art", "digital", "timelapse"], "Art", "public", 9800, 130000, 99],
  ["video_009", "creator_006", "Full brush settings breakdown.", ["art", "tutorial", "process"], "Art", "unlock_with_coins", 2100, 18000, 98, { coinUnlockPrice: 50, isPremium: true }],
  ["video_010", "creator_007", "Stop writing loops like this.", ["coding", "tips", "tech"], "Tech", "public", 16800, 260000, 96],
  ["video_011", "creator_007", "System design in 60 seconds: queues.", ["coding", "systemdesign", "tech"], "Tech", "public", 12300, 190000, 97],
  ["video_012", "creator_007", "The full interview prep roadmap.", ["career", "coding", "interview"], "Tech", "premium_tier_only", 4100, 36000, 97, { requiredTier: "premium", isPremium: true }],
  ["video_013", "creator_008", "Thrift flip: $8 jacket to festival fit.", ["fashion", "thrift", "style"], "Fashion", "public", 27400, 410000, 93],
  ["video_014", "creator_008", "Style rules I break on purpose.", ["fashion", "streetwear", "tips"], "Fashion", "public", 15900, 240000, 94],
  ["video_015", "creator_009", "This indie game deserves more players.", ["gaming", "indie", "review"], "Gaming", "public", 8700, 120000, 95],
  ["video_016", "creator_009", "Speedrun highlight: 12 seconds saved.", ["gaming", "speedrun", "clip"], "Gaming", "public", 6200, 90000, 96],
  ["video_017", "creator_010", "Making a beat from one kitchen sound.", ["music", "beats", "sounddesign"], "Music", "public", 5400, 71000, 97],
  ["video_018", "creator_001", "Unreleased track preview for subscribers.", ["music", "unreleased", "preview"], "Music", "subscribers_only", 3800, 29000, 95, { requiredTier: "plus", isPremium: true }],
  ["video_019", "creator_001", "How I mix vocals on the road.", ["music", "mixing", "tutorial"], "Music", "unlock_with_coins", 2900, 24000, 96, { coinUnlockPrice: 150, isPremium: true }],
  ["video_020", "creator_002", "Sunrise from the ferry, worth the 4am alarm.", ["travel", "sunrise", "slowtv"], "Travel", "public", 11800, 160000, 98],
  ["video_021", "creator_002", "Hidden alleys of the old town.", ["travel", "city", "walking"], "Travel", "public", 9100, 140000, 97],
  ["video_022", "creator_003", "RLS policies explained with pizza.", ["tech", "database", "security"], "Tech", "public", 5600, 62000, 98],
  ["video_023", "creator_004", "Knife skills: the only 3 cuts you need.", ["food", "skills", "kitchen"], "Food", "public", 22100, 350000, 97],
  ["video_024", "creator_005", "Handstand progress: month 1 to month 6.", ["fitness", "handstand", "progress"], "Fitness", "public", 19400, 300000, 98],
  ["video_025", "creator_008", "Subscriber-only lookbook: spring drop.", ["fashion", "lookbook", "exclusive"], "Fashion", "subscribers_only", 4800, 39000, 94, { requiredTier: "support", isPremium: true }],
  // Access-scenario fixtures: a private draft (owner/admin only) and a
  // followers-only clip, so every visibility mode is testable in mock mode.
  ["video_026", "creator_003", "Private: unreleased build walkthrough.", ["build", "wip"], "Tech", "private", 0, 0, 99],
  ["video_027", "creator_002", "Follower exclusive: packing for 6 months on the road.", ["travel", "packing", "followers"], "Travel", "followers_only", 1400, 12000, 97]
];

/** Public sample streams for development playback (no credentials needed). */
const sampleStreams = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
];

export const mockVideos: Video[] = seeds.map(
  ([id, creatorId, caption, hashtags, category, visibility, likeCount, watchCount, safetyScore, extras], index) => ({
    id,
    creatorId,
    caption,
    hashtags,
    category,
    visibility,
    status: "ready",
    moderationStatus: "visible",
    likeCount,
    commentCount: Math.round(likeCount / 32),
    shareCount: Math.round(likeCount / 14),
    saveCount: Math.round(likeCount / 9),
    watchCount,
    reportCount: index % 9 === 0 ? 2 : 0,
    revenue: extras?.isPremium ? Math.round(watchCount / 200) : 0,
    isPremium: false,
    safetyScore,
    // Every mock video has a playable URL. API surfaces strip it for gated
    // content; only the entitlement-checked /videos/:id/access returns it.
    playbackUrl: sampleStreams[index % sampleStreams.length],
    durationSeconds: 24 + ((index * 7) % 36),
    createdAt: new Date(Date.UTC(2026, 5, 1 + index, 12)).toISOString(),
    ...extras
  })
);
