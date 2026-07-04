import type {
  AdAccount,
  AdCampaign,
  AdCreative,
  AdGroup,
  Advertiser,
  DirectSponsorshipDeal,
  PlatformRevenueEntry,
  ServedAd
} from "@vuqiro/types";

/**
 * Deterministic advertising fixtures for credential-free development.
 * The chain is complete: advertiser → account → campaign → group → creative,
 * plus a manually sold direct sponsorship deal.
 */

export const mockAdvertisers: Advertiser[] = [
  {
    id: "adv_001",
    name: "Solstice Coffee",
    legalName: "Solstice Coffee Roasters AB",
    contactEmail: "marketing@solsticecoffee.example",
    contactName: "Elin Berg",
    websiteUrl: "https://solsticecoffee.example",
    country: "SE",
    status: "active",
    notes: "Direct-sold Q3 sponsorship + always-on CPM.",
    createdAt: "2026-05-02T09:00:00Z"
  },
  {
    id: "adv_002",
    name: "Nimbus Fitness",
    legalName: "Nimbus Fitness Inc.",
    contactEmail: "ads@nimbusfitness.example",
    contactName: "Jordan Reyes",
    websiteUrl: "https://nimbusfitness.example",
    country: "US",
    status: "active",
    notes: "",
    createdAt: "2026-05-20T14:30:00Z"
  }
];

export const mockAdAccounts: AdAccount[] = [
  {
    id: "adacct_001",
    advertiserId: "adv_001",
    name: "Solstice Coffee — Main",
    currency: "USD",
    balanceCents: 250000,
    status: "active",
    createdAt: "2026-05-02T09:05:00Z"
  },
  {
    id: "adacct_002",
    advertiserId: "adv_002",
    name: "Nimbus Fitness — Growth",
    currency: "USD",
    balanceCents: 120000,
    status: "active",
    createdAt: "2026-05-20T14:35:00Z"
  }
];

export const mockAdCampaigns: AdCampaign[] = [
  {
    id: "adcamp_001",
    adAccountId: "adacct_001",
    advertiserId: "adv_001",
    name: "Solstice Cold Brew Summer",
    objective: "awareness",
    buyingType: "cpm",
    status: "active",
    totalBudgetCents: 150000,
    dailyBudgetCents: 10000,
    spentCents: 43250,
    cpmPriceCents: 650,
    startsAt: "2026-06-01T00:00:00Z",
    endsAt: "2026-08-31T23:59:59Z",
    createdAt: "2026-05-02T10:00:00Z"
  },
  {
    id: "adcamp_002",
    adAccountId: "adacct_002",
    advertiserId: "adv_002",
    name: "Nimbus App Install Push",
    objective: "installs",
    buyingType: "cpc",
    status: "paused",
    totalBudgetCents: 80000,
    dailyBudgetCents: 5000,
    spentCents: 12480,
    cpcPriceCents: 45,
    startsAt: "2026-06-15T00:00:00Z",
    createdAt: "2026-05-20T15:00:00Z"
  },
  {
    id: "adcamp_003",
    adAccountId: "adacct_001",
    advertiserId: "adv_001",
    name: "Solstice Launch Week Takeover",
    objective: "awareness",
    buyingType: "fixed_sponsorship",
    status: "pending_review",
    fixedPriceCents: 500000,
    spentCents: 0,
    startsAt: "2026-09-01T00:00:00Z",
    endsAt: "2026-09-07T23:59:59Z",
    createdAt: "2026-06-10T09:00:00Z"
  }
];

export const mockAdGroups: AdGroup[] = [
  {
    id: "adgrp_001",
    campaignId: "adcamp_001",
    name: "Feed — coffee & food interests",
    status: "active",
    placements: ["feed"],
    targeting: { interests: ["food", "lifestyle"], countries: ["SE", "US"], minAge: 16 },
    frequencyCapPerDay: 4,
    createdAt: "2026-05-02T10:10:00Z"
  },
  {
    id: "adgrp_002",
    campaignId: "adcamp_002",
    name: "Feed + discover — fitness",
    status: "active",
    placements: ["feed", "discover"],
    targeting: { interests: ["fitness", "sports"], minAge: 16 },
    frequencyCapPerDay: 3,
    createdAt: "2026-05-20T15:10:00Z"
  }
];

export const mockAdCreatives: AdCreative[] = [
  {
    id: "adcr_001",
    adGroupId: "adgrp_001",
    campaignId: "adcamp_001",
    type: "card",
    title: "Cold brew, warm summer",
    body: "Solstice Cold Brew — small-batch roasted, delivered to your door.",
    ctaLabel: "Shop now",
    ctaUrl: "https://solsticecoffee.example/cold-brew",
    thumbnailUrl: "https://picsum.photos/seed/solstice/720/1280",
    reviewStatus: "approved",
    status: "active",
    createdAt: "2026-05-02T10:20:00Z"
  },
  {
    id: "adcr_002",
    adGroupId: "adgrp_002",
    campaignId: "adcamp_002",
    type: "card",
    title: "Train smarter with Nimbus",
    body: "Personalized workout plans that adapt to your progress.",
    ctaLabel: "Get the app",
    ctaUrl: "https://nimbusfitness.example/download",
    thumbnailUrl: "https://picsum.photos/seed/nimbus/720/1280",
    reviewStatus: "approved",
    status: "active",
    createdAt: "2026-05-20T15:20:00Z"
  },
  {
    id: "adcr_003",
    adGroupId: "adgrp_001",
    campaignId: "adcamp_001",
    type: "card",
    title: "Solstice Espresso Kit",
    body: "Everything you need for café-grade espresso at home.",
    ctaLabel: "Learn more",
    ctaUrl: "https://solsticecoffee.example/espresso-kit",
    thumbnailUrl: "https://picsum.photos/seed/espresso/720/1280",
    reviewStatus: "pending",
    status: "active",
    createdAt: "2026-06-28T08:00:00Z"
  }
];

export const mockSponsorshipDeals: DirectSponsorshipDeal[] = [
  {
    id: "spon_001",
    advertiserId: "adv_001",
    campaignId: "adcamp_003",
    name: "Launch Week Takeover — Sept 2026",
    description: "Fixed-price feed sponsorship during Vuqiro launch week.",
    fixedPriceCents: 500000,
    currency: "USD",
    status: "active",
    startsAt: "2026-09-01T00:00:00Z",
    endsAt: "2026-09-07T23:59:59Z",
    invoiceReference: "INV-2026-0042",
    createdAt: "2026-06-10T09:05:00Z"
  }
];

export const mockPlatformRevenue: PlatformRevenueEntry[] = [
  {
    id: "prl_001",
    source: "sponsorship",
    referenceType: "direct_sponsorship_deal",
    referenceId: "spon_001",
    amountCents: 500000,
    currency: "USD",
    description: "Solstice Launch Week Takeover (fixed)",
    occurredAt: "2026-06-10T09:06:00Z"
  },
  {
    id: "prl_002",
    source: "ad_revenue",
    referenceType: "ad_campaign",
    referenceId: "adcamp_001",
    amountCents: 43250,
    currency: "USD",
    description: "CPM delivery — Solstice Cold Brew Summer",
    occurredAt: "2026-07-01T00:00:00Z"
  },
  {
    id: "prl_003",
    source: "coin_purchase",
    referenceType: "purchase",
    amountCents: 128500,
    currency: "USD",
    description: "Coin pack sales (July)",
    occurredAt: "2026-07-01T00:00:00Z"
  }
];

/** A served ad ready for feed insertion in mock mode. */
export const mockServedAds: ServedAd[] = [
  {
    kind: "ad",
    creativeId: "adcr_001",
    campaignId: "adcamp_001",
    adGroupId: "adgrp_001",
    advertiserName: "Solstice Coffee",
    type: "card",
    title: "Cold brew, warm summer",
    body: "Solstice Cold Brew — small-batch roasted, delivered to your door.",
    ctaLabel: "Shop now",
    ctaUrl: "https://solsticecoffee.example/cold-brew",
    thumbnailUrl: "https://picsum.photos/seed/solstice/720/1280",
    placement: "feed"
  },
  {
    kind: "ad",
    creativeId: "adcr_002",
    campaignId: "adcamp_002",
    adGroupId: "adgrp_002",
    advertiserName: "Nimbus Fitness",
    type: "card",
    title: "Train smarter with Nimbus",
    body: "Personalized workout plans that adapt to your progress.",
    ctaLabel: "Get the app",
    ctaUrl: "https://nimbusfitness.example/download",
    thumbnailUrl: "https://picsum.photos/seed/nimbus/720/1280",
    placement: "feed"
  }
];
