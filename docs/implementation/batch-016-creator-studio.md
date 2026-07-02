# Batch 16 — Creator studio

Status: complete

## What changed

### API (`apps/api/src/routes/creatorStudio.ts`)

Every studio endpoint resolves the caller's own creator record via
`requireOwnCreator` — creators can never address another creator's data;
non-creators receive 403:

- `GET /creators/me/videos` — the creator's full catalog including drafts,
  processing, under-review and removed items (unlike public storefront
  queries).
- `GET /creators/me/subscribers` — active/grace/cancelled totals, tier
  breakdown and recent joins. **No payment data** is serialized (verified by
  test).
- `GET /creators/me/moderation` — warning count plus cases against the
  creator's videos or the creator record itself.
- `POST /creators/me/tiers` — tier availability settings (Zod-validated).
- `POST /creators/onboard` — creator onboarding: creator + storefront rows,
  `is_creator` flag.
- Existing self-scoped endpoints complete the picture:
  `GET /creators/me/analytics` (Batch 11), `GET /payouts/me` and
  `POST /payouts/onboarding` (Batch 15), `DELETE /videos/:id` (Batch 9),
  `POST /appeals` (Batch 12).

### Mobile (`app/studio/*`)

New studio stack reachable from Profile → "Open creator studio":

- **Overview** — 10 analytics cards (views, watch time, completion,
  followers/subscribers gained, tips, unlock/subscription revenue, payout
  pending/paid) + navigation to all sections.
- **Videos** — every upload with visibility/status/moderation/report badges,
  upload entry point, delete (calls the real API), and appeal shortcut on
  removed items.
- **Subscribers** — totals, tier breakdown, recent memberships with status.
- **Payouts** — Stripe account status with onboarding CTA (opens the real
  onboarding URL; payout-terms link shown before onboarding),
  payable/pending/held balances, active holds with reasons, payout history
  with failures.
- **Moderation** — warnings, case list with decisions, and a working appeal
  composer (posts to `/appeals`).
- **Settings** — tier toggles (saved via API), payout settings link,
  creator/payout terms links.

All screens run on live API data when `EXPO_PUBLIC_API_URL` is configured and
fall back to labelled demo data otherwise (`studioData.ts` hooks).

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 105 api tests
npx expo export --platform web             # bundles cleanly
```

7 new tests: studio auth on all endpoints, own-videos shape, subscriber
payload contains no payment fields, moderation standing, tier validation +
save, onboarding.

## Acceptance criteria

- [x] creator can manage own videos (list, delete, upload entry)
- [x] creator can see revenue (analytics + payout balances)
- [x] creator can see subscribers
- [x] creator can see payout status (live Stripe sync)
- [x] creator cannot access other creators' data (profile-scoped resolution)
- [x] creator sees moderation warnings (and can appeal)
- [x] creator cannot bypass moderation / force held payouts (no such endpoints exist; holds only released by admin)
