# Review Test Accounts

Never commit real credentials. This file documents which accounts must exist
and how to provision them; actual passwords go directly into the App Store
Connect / Play Console review fields.

## Local development seed accounts (`supabase/seed/seed.sql`)

The dev seed creates these accounts (no passwords in local Supabase Auth —
set them with `supabase auth` or the Studio when password sign-in is needed):

| Email | Handle | Role |
|---|---|---|
| `superadmin@vuqiro.app` | vuqiro_admin | platform_superadmin (console) |
| `admin@vuqiro.app` | vuqiro_ops | admin (console) |
| `moderator@vuqiro.app` | vuqiro_mod | moderator (console) |
| `finance@vuqiro.app` | vuqiro_fin | finance (console) |
| `support@vuqiro.app` | vuqiro_sup | support (console) |
| `viewer@example.com` | vuqiro_viewer | consumer (1,250-coin wallet, follows, likes, membership, interests) |
| `maya@example.com` etc. | maya, riven, noorbuilds, solacooks, kaimoves | creators with videos, ledgers, payout accounts |

Seeded business data: full ads chain (Solstice Coffee / Nimbus Fitness →
accounts → CPM/CPC/fixed campaigns → groups → creatives → active sponsorship
deal + platform revenue), moderation case + report + appeal + copyright
claim, moderation rules, platform settings, support case, integration-health
snapshots, notifications.

## Consumer review account

- Email: `review-viewer@vuqiro.app` (create in Supabase Auth before submission)
- Purpose: browsing, following, comments, wallet, locked-content demo
- Provisioning (run against production Supabase with the service role):
  1. Create the auth user (email/password) — the profile is auto-created.
  2. Seed the wallet: `select public.wallet_credit(profile_id, 1250, 'admin_adjustment', 'Review account seed', 'review-seed-1')`.
  3. Create 2–3 follows and one active membership so the Following feed and
     subscriber-only unlock are demonstrable.

## Creator review account

- Email: `review-creator@vuqiro.app`
- Purpose: creator studio, upload flow, analytics, payout dashboard
- Provisioning: create auth user → `POST /creators/onboard` as that user →
  upload 1–2 videos (one public, one coin-locked) → Stripe test-mode
  onboarding so the payout screen shows a verified state.

## Admin demo (NOT for store review)

- The admin console is not part of the mobile submission. Do not include
  admin credentials in review notes.

## Sandbox payment testers 🔑

- Apple: create a Sandbox Apple ID in App Store Connect → Users & Access →
  Sandbox testers; sign into it on the test device.
- Google: add license-tester Gmail accounts in Play Console → Settings →
  License testing; use the internal-testing track build.

## Checklist before each submission

- [ ] Both accounts sign in on a clean install
- [ ] Viewer account: feed plays, wallet shows balance, one video unlockable
- [ ] Creator account: studio loads, one video visible in feed
- [ ] Passwords rotated and entered into the review consoles (never in git)
