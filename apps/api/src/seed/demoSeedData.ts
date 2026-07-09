import { createHash } from "node:crypto";

/**
 * Deterministic demo/staging seed data: 12 fictional creators with 10
 * playable videos each, three access-scenario test users and synthetic view
 * events. Everything is pure and deterministic so the seed is idempotent and
 * unit-testable; all IO lives in demoSeed.ts.
 *
 * Content-safety rules encoded here:
 * - Every identity is invented (no real people's names or likenesses).
 * - Avatars are the app's initials-based avatars (no scraped photos);
 *   thumbnails come from Lorem Picsum (placeholder-licensed imagery).
 * - Videos are public sample media already used across this repo (Google's
 *   gtv-videos-bucket Blender/Chromecast sample clips + Mux's public test
 *   stream) — never scraped social content.
 * - Every row is marked is_demo/is_synthetic with seed_batch so it is
 *   excluded from production surfaces, monetization and reporting, and can
 *   be removed in one cleanup pass.
 */

export const DEMO_SEED_BATCH = "creator_video_access_test";

/** Demo auth users get this address space; never a deliverable domain. */
export const DEMO_EMAIL_DOMAIN = "vuqiro.test";

const UUID_NAMESPACE = "vuqiro-demo-seed-v1";

/** Deterministic RFC-4122-shaped id from stable name parts, so reruns
 * address the same rows and cleanup can never miss. */
export function deterministicUuid(...parts: string[]): string {
  const digest = createHash("sha1").update([UUID_NAMESPACE, ...parts].join(":")).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic 0..1 pseudo-random from a stable key. */
export function seededFraction(key: string): number {
  const digest = createHash("sha1").update(`${UUID_NAMESPACE}:rng:${key}`).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function seededInt(key: string, min: number, max: number): number {
  return Math.round(min + seededFraction(key) * (max - min));
}

/** Demo-safe playable sources (same conventions as packages/mock-data). */
const SAMPLE_STREAMS = [
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
];

function demoThumbnail(key: string): string {
  return `https://picsum.photos/seed/vuqiro-${key}/540/960`;
}

type CreatorSize = "small" | "medium" | "large";

export type DemoCreatorDef = {
  handle: string;
  displayName: string;
  bio: string;
  category: string;
  bannerTone: "violet" | "cyan" | "rose" | "amber" | "emerald";
  size: CreatorSize;
  verified: boolean;
  /**
   * Exactly 10 captions per creator. Layout is parity-based:
   * - even creator index: captions 0-6 public, 7-8 members-only, 9 private
   * - odd creator index:  captions 0-7 public, 8 members-only, 9 private
   * Members-only captions are authored as exclusives; the private caption is
   * a draft/personal note that must never surface publicly.
   */
  captions: string[];
  hashtags: string[];
};

/** 12 fictional creators. Names/handles are invented for this product. */
export const DEMO_CREATORS: DemoCreatorDef[] = [
  {
    handle: "demo_novatrails",
    displayName: "Nova Trails",
    bio: "Micro-hikes, hidden viewpoints and trail snacks. New route every week.",
    category: "Travel",
    bannerTone: "emerald",
    size: "large",
    verified: true,
    captions: [
      "Sunrise from the ridge — worth every switchback.",
      "This trail is 20 minutes from the city and nobody knows it.",
      "Packing my daypack in 45 seconds.",
      "Rain hike essentials that actually work.",
      "The viewpoint at km 7 never disappoints.",
      "Trail snack tier list, no debate.",
      "Golden hour on the coastal path.",
      "Members: my exact GPS routes for this month.",
      "Members: gear closet tour + what I'd skip.",
      "Private: scouting footage for the autumn series."
    ],
    hashtags: ["hiking", "trails", "outdoors", "travel"]
  },
  {
    handle: "demo_forkful",
    displayName: "Forkful",
    bio: "Fast, loud, delicious. 60-second recipes that respect your budget.",
    category: "Food",
    bannerTone: "amber",
    size: "large",
    verified: true,
    captions: [
      "Crispy rice in 8 minutes, one pan.",
      "The 3-ingredient sauce I put on everything.",
      "Midnight noodles, dorm edition.",
      "Stop overcooking your greens — do this.",
      "Market haul to dinner in 60 seconds.",
      "One skillet, four meals this week.",
      "The dumpling fold you can learn today.",
      "Brown butter changes everything.",
      "Members: full recipe cards for this month's drops.",
      "Private: test kitchen fail reel (do not post)."
    ],
    hashtags: ["food", "recipe", "cooking", "fast"]
  },
  {
    handle: "demo_kilowattfit",
    displayName: "Kilowatt Fit",
    bio: "No-equipment training blocks. Show up for 15 minutes, leave stronger.",
    category: "Fitness",
    bannerTone: "rose",
    size: "medium",
    verified: true,
    captions: [
      "15-minute full body, zero excuses.",
      "Fix your squat depth with this drill.",
      "Doorframe mobility routine for desk days.",
      "The warmup I never skip.",
      "Beginner push-up progression that works.",
      "Core block: 4 moves, 8 minutes.",
      "Stretch this after every run.",
      "Members: my exact weekly programming.",
      "Members: form-check breakdowns from this week.",
      "Private: injury rehab notes, week 2."
    ],
    hashtags: ["fitness", "training", "mobility", "workout"]
  },
  {
    handle: "demo_pixelplay",
    displayName: "Pixel Play",
    bio: "Indie gems, speedrun clips and honest 60-second reviews.",
    category: "Gaming",
    bannerTone: "violet",
    size: "medium",
    verified: false,
    captions: [
      "This indie deserves 100x more players.",
      "Speedrun highlight: 14 seconds saved on the ice level.",
      "The best hidden mechanic of the year.",
      "Ranked every boss in 60 seconds.",
      "Cozy games for a rainy weekend.",
      "This soundtrack alone is worth it.",
      "Frame-perfect trick, finally landed.",
      "My controller settings, explained.",
      "Members: full run VOD with commentary.",
      "Private: embargoed preview build clip."
    ],
    hashtags: ["gaming", "indie", "speedrun", "review"]
  },
  {
    handle: "demo_looply",
    displayName: "Looply",
    bio: "Beats from found sounds. Kitchen percussion is real percussion.",
    category: "Music",
    bannerTone: "cyan",
    size: "medium",
    verified: true,
    captions: [
      "Made a beat from my kettle.",
      "Layering 4 loops into a chorus.",
      "This bassline started as a door creak.",
      "One-minute mixing tip: cut, don't boost.",
      "Sampling the subway platform.",
      "From voice memo to drop in 60 seconds.",
      "The pad sound everyone asks about.",
      "Members: full project file walkthrough.",
      "Members: unreleased track preview.",
      "Private: label demo, unmastered."
    ],
    hashtags: ["music", "beats", "sounddesign", "producer"]
  },
  {
    handle: "demo_brushwork",
    displayName: "Brushwork",
    bio: "Digital painting timelapses and the process behind every layer.",
    category: "Art",
    bannerTone: "violet",
    size: "small",
    verified: false,
    captions: [
      "40 hours of painting in 45 seconds.",
      "Blocking in light before anything else.",
      "My 5 most-used brushes, ranked.",
      "Color-picking from film stills.",
      "Fixing muddy values in two passes.",
      "Thumbnail sketches: quantity first.",
      "The eyes come last. Always.",
      "Commission reveal: the stained-glass fox.",
      "Members: full-resolution process breakdown.",
      "Private: client work-in-progress (under NDA)."
    ],
    hashtags: ["art", "digitalart", "timelapse", "process"]
  },
  {
    handle: "demo_stackline",
    displayName: "Stackline",
    bio: "One-minute engineering lessons. Ship simple, sleep well.",
    category: "Tech",
    bannerTone: "emerald",
    size: "medium",
    verified: true,
    captions: [
      "Stop writing loops like this.",
      "Queues explained with a coffee shop.",
      "The schema mistake every side project makes.",
      "Rate limiting in 60 seconds.",
      "Why your cache invalidation bit you.",
      "Naming things: a survival guide.",
      "Ship the boring version first.",
      "Members: system design deep-dive, part 1.",
      "Members: my interview prep roadmap.",
      "Private: conference talk rehearsal take 3."
    ],
    hashtags: ["tech", "coding", "engineering", "tips"]
  },
  {
    handle: "demo_threadbare",
    displayName: "Threadbare",
    bio: "Thrift flips and street fits on a student budget.",
    category: "Fashion",
    bannerTone: "amber",
    size: "large",
    verified: true,
    captions: [
      "$6 jacket to festival fit.",
      "Three fits from one pair of cargos.",
      "Thrift haul: what I kept and why.",
      "Hemming without a sewing machine.",
      "Style rules I break on purpose.",
      "Layering for people who run hot.",
      "The shoe rotation, honest edition.",
      "Color matching from your camera roll.",
      "Members: full lookbook — spring drop.",
      "Private: brand collab sample unboxing (embargo)."
    ],
    hashtags: ["fashion", "thrift", "style", "streetwear"]
  },
  {
    handle: "demo_petalspaws",
    displayName: "Petals & Paws",
    bio: "Garden rescues and the dogs who supervise them.",
    category: "Lifestyle",
    bannerTone: "rose",
    size: "small",
    verified: false,
    captions: [
      "Repotting day. Foreman on duty.",
      "This balcony went from bare to jungle.",
      "Propagating in water: week 3 update.",
      "The dog approved this raised bed.",
      "Rescue fern, six weeks later.",
      "Watering schedule that finally works.",
      "Compost in a small flat: yes, really.",
      "Members: monthly plant-care calendar.",
      "Members: Q&A replay — pest edition.",
      "Private: vet visit vlog, still deciding."
    ],
    hashtags: ["plants", "garden", "dogs", "cozy"]
  },
  {
    handle: "demo_midnightlens",
    displayName: "Midnight Lens",
    bio: "Night photography on foot. City light is free light.",
    category: "Photography",
    bannerTone: "cyan",
    size: "small",
    verified: false,
    captions: [
      "Shooting neon in the rain.",
      "Handheld at midnight: settings that work.",
      "One block, five compositions.",
      "Editing night shots without crushing blacks.",
      "Reflections are the cheat code.",
      "Why I stopped chasing blue hour.",
      "Street portraits with one lamp post.",
      "The alley shot everyone asks about.",
      "Members: full RAW edit walkthrough.",
      "Private: location scouting notes, unlisted spots."
    ],
    hashtags: ["photography", "night", "city", "street"]
  },
  {
    handle: "demo_chalktalk",
    displayName: "Chalk Talk",
    bio: "Big ideas on a small whiteboard. Learn one thing per video.",
    category: "Education",
    bannerTone: "emerald",
    size: "medium",
    verified: true,
    captions: [
      "Compound interest in 45 seconds.",
      "Why maps lie to you.",
      "The birthday paradox, drawn out.",
      "How noise-cancelling actually works.",
      "Supply and demand with two curves.",
      "What a standard deviation really means.",
      "The trick to reading nutrition labels.",
      "Members: extended lesson — probability.",
      "Members: printable study sheets walkthrough.",
      "Private: next semester's syllabus draft."
    ],
    hashtags: ["learning", "explainer", "science", "education"]
  },
  {
    handle: "demo_groovelab",
    displayName: "Groove Lab",
    bio: "Choreo breakdowns at real-people speed. Eight counts at a time.",
    category: "Dance",
    bannerTone: "rose",
    size: "large",
    verified: true,
    captions: [
      "This combo in 3 speeds.",
      "Footwork drill for sticky floors.",
      "Learn the chorus in 8 counts.",
      "Freestyle prompts to loosen up.",
      "Small-room choreo that still hits.",
      "Musicality: dance the drums, not the melody.",
      "Partner mirror drill, no partner needed.",
      "Warmup flow I teach every class.",
      "Members: full-length class replay.",
      "Private: audition tape, fingers crossed."
    ],
    hashtags: ["dance", "choreo", "tutorial", "moves"]
  }
];

const FOLLOWER_RANGE: Record<CreatorSize, [number, number]> = {
  small: [2_400, 18_000],
  medium: [18_000, 90_000],
  large: [90_000, 420_000]
};

const VIEW_RANGE: Record<CreatorSize, [number, number]> = {
  small: [500, 5_000],
  medium: [5_000, 50_000],
  large: [50_000, 250_000]
};

export type DemoVideoPlan = {
  id: string;
  caption: string;
  hashtags: string[];
  category: string;
  visibility: "public" | "subscribers_only" | "private";
  requiredTier: "support" | null;
  playbackUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  watchCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  createdAt: string;
  isDemo: true;
  seedBatch: typeof DEMO_SEED_BATCH;
};

export type DemoCreatorPlan = {
  profileId: string;
  creatorId: string;
  handle: string;
  email: string;
  displayName: string;
  bio: string;
  category: string;
  bannerTone: DemoCreatorDef["bannerTone"];
  verified: boolean;
  followerCount: number;
  totalLikeCount: number;
  createdAt: string;
  videos: DemoVideoPlan[];
  isDemo: true;
  seedBatch: typeof DEMO_SEED_BATCH;
};

export type DemoUserPlan = {
  profileId: string;
  handle: string;
  email: string;
  displayName: string;
  bio: string;
  /** Handle of the demo creator this user holds a membership for, if any. */
  memberOfHandle?: string;
  membershipTier?: "support" | "plus";
  isDemo: true;
  seedBatch: typeof DEMO_SEED_BATCH;
};

export type DemoEventPlan = {
  videoId: string;
  name: "video_impression" | "video_qualified_view" | "video_complete";
  createdAt: string;
  isSynthetic: true;
  seedBatch: typeof DEMO_SEED_BATCH;
};

export type DemoPlan = {
  seedBatch: typeof DEMO_SEED_BATCH;
  creators: DemoCreatorPlan[];
  users: DemoUserPlan[];
  events: DemoEventPlan[];
};

/** Parity-based visibility layout (see DemoCreatorDef.captions docs). */
export function visibilityFor(creatorIndex: number, videoIndex: number): DemoVideoPlan["visibility"] {
  if (videoIndex === 9) return "private";
  const membersOnlyCount = creatorIndex % 2 === 0 ? 2 : 1;
  return videoIndex >= 9 - membersOnlyCount ? "subscribers_only" : "public";
}

/** Builds the full deterministic plan. Pure: no IO, no randomness. */
export function buildDemoPlan(): DemoPlan {
  const creators: DemoCreatorPlan[] = DEMO_CREATORS.map((def, creatorIndex) => {
    const profileId = deterministicUuid("profile", def.handle);
    const creatorId = deterministicUuid("creator", def.handle);
    const [minFollowers, maxFollowers] = FOLLOWER_RANGE[def.size];
    const followerCount = seededInt(`${def.handle}:followers`, minFollowers, maxFollowers);
    // Creators joined 4-14 months ago, staggered.
    const createdAt = new Date(Date.UTC(2025, 4 + (creatorIndex % 9), 1 + creatorIndex * 2, 9)).toISOString();

    const videos: DemoVideoPlan[] = def.captions.map((caption, videoIndex) => {
      const visibility = visibilityFor(creatorIndex, videoIndex);
      const key = `${def.handle}:video:${videoIndex}`;
      const [minViews, maxViews] = VIEW_RANGE[def.size];
      // Gated/private videos get lower counters (fewer people can see them).
      const gatedFactor = visibility === "public" ? 1 : visibility === "subscribers_only" ? 0.18 : 0;
      const watchCount = Math.round(seededInt(`${key}:views`, minViews, maxViews) * gatedFactor);
      const likeRate = 0.03 + seededFraction(`${key}:likes`) * 0.05; // 3-8% of views
      const likeCount = Math.round(watchCount * likeRate);
      const commentCount = Math.round(likeCount * (0.03 + seededFraction(`${key}:comments`) * 0.02));
      const shareCount = Math.round(likeCount * (0.06 + seededFraction(`${key}:shares`) * 0.06));
      const saveCount = Math.round(likeCount * (0.08 + seededFraction(`${key}:saves`) * 0.08));
      return {
        id: deterministicUuid("video", def.handle, String(videoIndex)),
        caption,
        hashtags: def.hashtags,
        category: def.category,
        visibility,
        requiredTier: visibility === "subscribers_only" ? ("support" as const) : null,
        playbackUrl: SAMPLE_STREAMS[(creatorIndex + videoIndex) % SAMPLE_STREAMS.length],
        thumbnailUrl: demoThumbnail(`${def.handle}-${videoIndex}`),
        durationSeconds: 15 + seededInt(`${key}:duration`, 0, 45),
        watchCount,
        likeCount,
        commentCount,
        shareCount,
        saveCount,
        createdAt: new Date(
          Date.UTC(2026, 3 + (videoIndex % 3), 2 + creatorIndex + videoIndex * 8, 10 + videoIndex)
        ).toISOString(),
        isDemo: true as const,
        seedBatch: DEMO_SEED_BATCH
      };
    });

    return {
      profileId,
      creatorId,
      handle: def.handle,
      email: `demo-${def.handle.replace(/_/g, "-")}@${DEMO_EMAIL_DOMAIN}`,
      displayName: def.displayName,
      bio: def.bio,
      category: def.category,
      bannerTone: def.bannerTone,
      verified: def.verified,
      followerCount,
      totalLikeCount: videos.reduce((sum, video) => sum + video.likeCount, 0),
      createdAt,
      videos,
      isDemo: true as const,
      seedBatch: DEMO_SEED_BATCH
    };
  });

  // Access-scenario users: a free viewer plus one member of creator A
  // (first demo creator) and one member of creator B (second demo creator).
  const users: DemoUserPlan[] = [
    {
      profileId: deterministicUuid("profile", "demo_free_viewer"),
      handle: "demo_free_viewer",
      email: `demo-free-viewer@${DEMO_EMAIL_DOMAIN}`,
      displayName: "Demo Free Viewer",
      bio: "Demo account: logged-in viewer with no memberships.",
      isDemo: true,
      seedBatch: DEMO_SEED_BATCH
    },
    {
      profileId: deterministicUuid("profile", "demo_member_a"),
      handle: "demo_member_a",
      email: `demo-member-a@${DEMO_EMAIL_DOMAIN}`,
      displayName: "Demo Member A",
      bio: `Demo account: active member of @${creators[0].handle}.`,
      memberOfHandle: creators[0].handle,
      membershipTier: "support",
      isDemo: true,
      seedBatch: DEMO_SEED_BATCH
    },
    {
      profileId: deterministicUuid("profile", "demo_member_b"),
      handle: "demo_member_b",
      email: `demo-member-b@${DEMO_EMAIL_DOMAIN}`,
      displayName: "Demo Member B",
      bio: `Demo account: active member of @${creators[1].handle}.`,
      memberOfHandle: creators[1].handle,
      membershipTier: "plus",
      isDemo: true,
      seedBatch: DEMO_SEED_BATCH
    }
  ];

  // A handful of event-level synthetic rows per creator's top public video so
  // rollup/trending exclusion is testable. Aggregate counters live on the
  // video rows themselves (marked is_demo).
  const events: DemoEventPlan[] = creators.flatMap((creator) => {
    const topPublic = creator.videos.find((video) => video.visibility === "public");
    if (!topPublic) return [];
    return (["video_impression", "video_qualified_view", "video_complete"] as const).map((name, index) => ({
      videoId: topPublic.id,
      name,
      createdAt: new Date(Date.UTC(2026, 6, 1, 12 + index)).toISOString(),
      isSynthetic: true as const,
      seedBatch: DEMO_SEED_BATCH
    }));
  });

  return { seedBatch: DEMO_SEED_BATCH, creators, users, events };
}
