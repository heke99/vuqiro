import { mockServedAds } from "@vuqiro/mock-data";
import type { ServedAd } from "@vuqiro/types";
import { getServiceDb, isBackendConfigured } from "./supabase";

/**
 * Ad selection + delivery accounting.
 *
 * Selection rules (all enforced server-side):
 *   - campaign active, inside its start/end window, budget not exhausted
 *   - ad group active and sold for the requested placement
 *   - creative approved + active
 *   - per-viewer per-campaign daily frequency cap not exceeded
 *   - targeting: country/language always contextual; interest targeting is
 *     only used for viewers who opted IN to personalized ads — opted-out
 *     viewers never receive interest-targeted groups
 */

export type AdViewer = {
  profileId?: string;
  anonSessionId?: string;
  country?: string;
  language?: string;
  interests?: string[];
  personalizedAdsOptIn: boolean;
};

type CampaignRow = {
  id: string;
  ad_account_id: string;
  advertiser_id: string;
  buying_type: string;
  status: string;
  total_budget_cents: number | null;
  daily_budget_cents: number | null;
  spent_cents: number;
  cpm_price_cents: number | null;
  cpc_price_cents: number | null;
  starts_at: string | null;
  ends_at: string | null;
  advertisers: { name: string; status: string } | null;
};

type GroupRow = {
  id: string;
  campaign_id: string;
  status: string;
  placements: string[];
  targeting: {
    countries?: string[];
    languages?: string[];
    interests?: string[];
    min_age?: number;
  };
  frequency_cap_per_day: number;
};

type CreativeRow = {
  id: string;
  ad_group_id: string;
  campaign_id: string;
  type: string;
  title: string;
  body: string;
  cta_label: string;
  cta_url: string;
  media_url: string | null;
  thumbnail_url: string | null;
  review_status: string;
  status: string;
};

export function viewerKey(viewer: AdViewer): string {
  return viewer.profileId ?? `anon:${viewer.anonSessionId ?? "unknown"}`;
}

let mockRotation = 0;

/** Select up to `count` ads for the viewer/placement. */
export async function selectAds(viewer: AdViewer, placement: string, count: number): Promise<ServedAd[]> {
  if (count <= 0) return [];
  if (!isBackendConfigured()) {
    const ads: ServedAd[] = [];
    for (let i = 0; i < count && mockServedAds.length > 0; i += 1) {
      ads.push({ ...mockServedAds[mockRotation % mockServedAds.length], placement: placement as ServedAd["placement"] });
      mockRotation += 1;
    }
    return ads;
  }

  const db = getServiceDb()!;
  const nowIso = new Date().toISOString();

  const { data: campaigns } = await db
    .from("ad_campaigns")
    .select(
      "id, ad_account_id, advertiser_id, buying_type, status, total_budget_cents, daily_budget_cents, spent_cents, cpm_price_cents, cpc_price_cents, starts_at, ends_at, advertisers (name, status)"
    )
    .eq("status", "active")
    .limit(200);

  const budgetedCampaigns = ((campaigns ?? []) as unknown as CampaignRow[]).filter((campaign) => {
    if (campaign.advertisers?.status !== "active") return false;
    if (campaign.starts_at && campaign.starts_at > nowIso) return false;
    if (campaign.ends_at && campaign.ends_at < nowIso) return false;
    if (
      campaign.total_budget_cents !== null &&
      campaign.buying_type !== "fixed_sponsorship" &&
      campaign.spent_cents >= campaign.total_budget_cents
    ) {
      return false;
    }
    return true;
  });
  if (budgetedCampaigns.length === 0) return [];

  // Daily pacing: campaigns with a daily budget stop serving once today's
  // billing events reach it (spend resumes tomorrow).
  const dailyCapped = budgetedCampaigns.filter((campaign) => campaign.daily_budget_cents !== null);
  let dailySpend = new Map<string, number>();
  if (dailyCapped.length > 0) {
    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
    const { data: todaysBilling } = await db
      .from("ad_billing_events")
      .select("campaign_id, amount_cents")
      .in("campaign_id", dailyCapped.map((campaign) => campaign.id))
      .gte("created_at", todayStart)
      .limit(5000);
    dailySpend = new Map<string, number>();
    for (const event of todaysBilling ?? []) {
      if (!event.campaign_id) continue;
      dailySpend.set(event.campaign_id, (dailySpend.get(event.campaign_id) ?? 0) + event.amount_cents);
    }
  }
  const activeCampaigns = budgetedCampaigns.filter((campaign) => {
    if (campaign.daily_budget_cents === null) return true;
    return (dailySpend.get(campaign.id) ?? 0) < campaign.daily_budget_cents;
  });
  if (activeCampaigns.length === 0) return [];
  const campaignIds = activeCampaigns.map((campaign) => campaign.id);

  const { data: groups } = await db
    .from("ad_groups")
    .select("id, campaign_id, status, placements, targeting, frequency_cap_per_day")
    .in("campaign_id", campaignIds)
    .eq("status", "active")
    .contains("placements", [placement]);

  const eligibleGroups = ((groups ?? []) as unknown as GroupRow[]).filter((group) => {
    const targeting = group.targeting ?? {};
    if (targeting.countries && targeting.countries.length > 0) {
      if (!viewer.country || !targeting.countries.includes(viewer.country)) return false;
    }
    if (targeting.languages && targeting.languages.length > 0) {
      if (!viewer.language || !targeting.languages.includes(viewer.language)) return false;
    }
    if (targeting.interests && targeting.interests.length > 0) {
      // Interest targeting is personalization: opted-out viewers are excluded.
      if (!viewer.personalizedAdsOptIn) return false;
      const viewerInterests = new Set(viewer.interests ?? []);
      if (!targeting.interests.some((interest) => viewerInterests.has(interest))) return false;
    }
    return true;
  });
  if (eligibleGroups.length === 0) return [];

  // Frequency caps: exclude campaigns the viewer has already seen enough today.
  const key = viewerKey(viewer);
  const today = new Date().toISOString().slice(0, 10);
  const { data: caps } = await db
    .from("ad_frequency_caps")
    .select("campaign_id, impression_count")
    .eq("viewer_key", key)
    .eq("cap_date", today)
    .in(
      "campaign_id",
      eligibleGroups.map((group) => group.campaign_id)
    );
  const capByCampaign = new Map((caps ?? []).map((row) => [row.campaign_id, row.impression_count]));
  const cappedGroups = eligibleGroups.filter(
    (group) => (capByCampaign.get(group.campaign_id) ?? 0) < group.frequency_cap_per_day
  );
  if (cappedGroups.length === 0) return [];

  const { data: creatives } = await db
    .from("ad_creatives")
    .select("id, ad_group_id, campaign_id, type, title, body, cta_label, cta_url, media_url, thumbnail_url, review_status, status")
    .in(
      "ad_group_id",
      cappedGroups.map((group) => group.id)
    )
    .eq("review_status", "approved")
    .eq("status", "active");

  const eligibleCreatives = (creatives ?? []) as unknown as CreativeRow[];
  if (eligibleCreatives.length === 0) return [];

  const campaignById = new Map(activeCampaigns.map((campaign) => [campaign.id, campaign]));
  // Shuffle for rotation fairness, then take distinct campaigns first.
  const shuffled = [...eligibleCreatives].sort(() => Math.random() - 0.5);
  const picked: CreativeRow[] = [];
  const usedCampaigns = new Set<string>();
  for (const creative of shuffled) {
    if (picked.length >= count) break;
    if (usedCampaigns.has(creative.campaign_id)) continue;
    picked.push(creative);
    usedCampaigns.add(creative.campaign_id);
  }
  for (const creative of shuffled) {
    if (picked.length >= count) break;
    if (!picked.includes(creative)) picked.push(creative);
  }

  return picked.map((creative) => ({
    kind: "ad" as const,
    creativeId: creative.id,
    campaignId: creative.campaign_id,
    adGroupId: creative.ad_group_id,
    advertiserName: campaignById.get(creative.campaign_id)?.advertisers?.name ?? "Sponsor",
    type: creative.type as ServedAd["type"],
    title: creative.title,
    body: creative.body,
    ctaLabel: creative.cta_label,
    ctaUrl: creative.cta_url,
    mediaUrl: creative.media_url ?? undefined,
    thumbnailUrl: creative.thumbnail_url ?? undefined,
    placement: placement as ServedAd["placement"]
  }));
}

/** Reconcile CPM spend + billing after new impressions (idempotent). */
async function reconcileCpmBilling(campaignId: string): Promise<void> {
  const db = getServiceDb()!;
  const { data: campaign } = await db
    .from("ad_campaigns")
    .select("id, ad_account_id, buying_type, cpm_price_cents, spent_cents")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.buying_type !== "cpm" || !campaign.cpm_price_cents) return;

  const { count } = await db
    .from("ad_impressions")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  const expectedSpend = Math.floor(((count ?? 0) * campaign.cpm_price_cents) / 1000);
  if (expectedSpend <= campaign.spent_cents) return;

  const delta = expectedSpend - campaign.spent_cents;
  const idempotencyKey = `cpm:${campaignId}:${expectedSpend}`;
  const { error: billingError } = await db.from("ad_billing_events").insert({
    ad_account_id: campaign.ad_account_id,
    campaign_id: campaignId,
    type: "impression_charge",
    amount_cents: delta,
    description: `CPM delivery charge (${count} impressions)`,
    idempotency_key: idempotencyKey
  });
  if (billingError && billingError.code !== "23505") return;
  if (!billingError) {
    await db.from("platform_revenue_ledger").insert({
      source: "ad_revenue",
      reference_type: "ad_campaign",
      reference_id: campaignId,
      amount_cents: delta,
      description: "CPM ad delivery revenue",
      idempotency_key: `prl:${idempotencyKey}`
    });
  }
  await db.from("ad_campaigns").update({ spent_cents: expectedSpend }).eq("id", campaignId);
}

export type AdDeliveryEvent = {
  creativeId: string;
  viewer: AdViewer;
  placement: string;
};

/** Record an impression: delivery row, frequency cap bump, CPM accounting. */
export async function recordAdImpression(event: AdDeliveryEvent): Promise<{ recorded: boolean }> {
  if (!isBackendConfigured()) return { recorded: true };
  const db = getServiceDb()!;
  const { data: creative } = await db
    .from("ad_creatives")
    .select("id, ad_group_id, campaign_id")
    .eq("id", event.creativeId)
    .maybeSingle();
  if (!creative) return { recorded: false };

  await db.from("ad_impressions").insert({
    creative_id: creative.id,
    ad_group_id: creative.ad_group_id,
    campaign_id: creative.campaign_id,
    profile_id: event.viewer.profileId ?? null,
    anon_session_id: event.viewer.anonSessionId ?? null,
    placement: event.placement,
    country: event.viewer.country ?? null
  });

  // Frequency cap upsert.
  const key = viewerKey(event.viewer);
  const today = new Date().toISOString().slice(0, 10);
  const { data: cap } = await db
    .from("ad_frequency_caps")
    .select("id, impression_count")
    .eq("campaign_id", creative.campaign_id)
    .eq("viewer_key", key)
    .eq("cap_date", today)
    .maybeSingle();
  if (cap) {
    await db
      .from("ad_frequency_caps")
      .update({ impression_count: cap.impression_count + 1 })
      .eq("id", cap.id);
  } else {
    await db
      .from("ad_frequency_caps")
      .insert({ campaign_id: creative.campaign_id, viewer_key: key, cap_date: today, impression_count: 1 });
  }

  await reconcileCpmBilling(creative.campaign_id);
  return { recorded: true };
}

/** Record a click: delivery row + CPC billing (idempotent per click id). */
export async function recordAdClick(event: AdDeliveryEvent): Promise<{ recorded: boolean }> {
  if (!isBackendConfigured()) return { recorded: true };
  const db = getServiceDb()!;
  const { data: creative } = await db
    .from("ad_creatives")
    .select("id, ad_group_id, campaign_id")
    .eq("id", event.creativeId)
    .maybeSingle();
  if (!creative) return { recorded: false };

  const { data: click } = await db
    .from("ad_clicks")
    .insert({
      creative_id: creative.id,
      ad_group_id: creative.ad_group_id,
      campaign_id: creative.campaign_id,
      profile_id: event.viewer.profileId ?? null,
      anon_session_id: event.viewer.anonSessionId ?? null,
      placement: event.placement,
      country: event.viewer.country ?? null
    })
    .select("id")
    .single();

  const { data: campaign } = await db
    .from("ad_campaigns")
    .select("id, ad_account_id, buying_type, cpc_price_cents, spent_cents")
    .eq("id", creative.campaign_id)
    .maybeSingle();
  if (campaign?.buying_type === "cpc" && campaign.cpc_price_cents && click) {
    const idempotencyKey = `cpc:${click.id}`;
    const { error: billingError } = await db.from("ad_billing_events").insert({
      ad_account_id: campaign.ad_account_id,
      campaign_id: campaign.id,
      type: "click_charge",
      amount_cents: campaign.cpc_price_cents,
      description: "CPC click charge",
      idempotency_key: idempotencyKey
    });
    if (!billingError) {
      await db.from("platform_revenue_ledger").insert({
        source: "ad_revenue",
        reference_type: "ad_campaign",
        reference_id: campaign.id,
        amount_cents: campaign.cpc_price_cents,
        description: "CPC ad click revenue",
        idempotency_key: `prl:${idempotencyKey}`
      });
      await db
        .from("ad_campaigns")
        .update({ spent_cents: campaign.spent_cents + campaign.cpc_price_cents })
        .eq("id", campaign.id);
    }
  }
  return { recorded: true };
}
