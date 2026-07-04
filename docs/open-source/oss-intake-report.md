# Open-Source Intake Report

Every open-source project researched for the Vuqiro 99%-completion pass is
recorded here with its license, what it may be used for, and what (if
anything) was taken from it.

**Policy** (see also `docs/legal/source-usage.md` and
`references/open-source/README.md`):

- MIT / Apache-2.0 / BSD / ISC → may be ported directly with attribution
  where required.
- GPL / AGPL / LGPL / other copyleft → **architecture and product reference
  only**; no code is copied. Features inspired by these projects are
  reimplemented clean-room.
- No code is taken from any private project owned by Diversa Solutions LLC's
  founder (Nordklart, Gridex, Resqly, Fakturaportföljen, etc.).

Risk levels: **low** (permissive, attribution handled by package manager),
**medium** (permissive but code was read closely — attribution documented),
**high** (copyleft — reference only, no code reuse).

---

## Approved for code porting

Permissively licensed projects and libraries. Code may be copied/adapted with
license headers kept where present. In practice these are consumed as npm
dependencies, which preserves their LICENSE files inside `node_modules` and in
the published package tarballs.

| Project | Source | License | Purpose | Copied code | Clean-room | Attribution | Risk |
|---|---|---|---|---|---|---|---|
| Hono | github.com/honojs/hono | MIT | API framework, middleware patterns (CORS, headers) | Used as dependency; middleware wiring follows official docs examples | — | Via package | low |
| supabase-js | github.com/supabase/supabase-js | MIT | DB/auth client | Dependency only | — | Via package | low |
| Supabase examples & docs | github.com/supabase/supabase | Apache-2.0 | RLS policy patterns, storage policy patterns, `security definer` helper-function patterns | SQL policy *patterns* adapted (idiomatic Supabase style, not verbatim files) | — | Noted here + third-party notices | low |
| Zod | github.com/colinhacks/zod | MIT | Env + request validation | Dependency only | — | Via package | low |
| expo / expo-video / expo-router / expo-notifications / expo-image-picker | github.com/expo/expo | MIT | Mobile runtime, video player, navigation, push, media pick | Dependencies; push-token registration flow follows Expo docs | — | Via package | low |
| Expo Server SDK pattern (push HTTP/2 API) | docs.expo.dev/push-notifications | MIT (docs examples) | Expo push provider adapter | HTTP contract (endpoint/body shape) from public API docs | Adapter itself written for Vuqiro | Noted here | low |
| react-native-purchases (RevenueCat SDK) | github.com/RevenueCat/react-native-purchases | MIT | IAP foundation | Dependency only | — | Via package | low |
| Stripe API (openapi + docs) | github.com/stripe/openapi | MIT | Stripe Connect payout adapter HTTP contracts | Endpoint shapes from public API reference | Adapter written for Vuqiro | Via docs | low |
| Next.js | github.com/vercel/next.js | MIT | Admin console framework | Dependency only | — | Via package | low |
| @supabase/ssr | github.com/supabase/ssr | MIT | Admin server-side auth | Dependency only | — | Via package | low |
| Vitest | github.com/vitest-dev/vitest | MIT | Test runner | Dependency only | — | Via package | low |
| tsx | github.com/privatenumber/tsx | MIT | API dev runner | Dependency only | — | Via package | low |
| sharp | github.com/lovell/sharp | Apache-2.0 | Asset generation script | Dependency only | — | Via package | low |
| react-native-video-feed (samuelrvg) | github.com/samuelrvg/react-native-video-feed | MIT | Vertical feed pager reference (FlatList paging, viewability autoplay) | Viewability-config pattern (threshold + active-index) adapted in Batch 5 | Feed implementation is Vuqiro-specific | Noted here | medium |

## Reference only

Studied for product behavior, data models and flows. **No code copied.**

| Project | Source | License | Used as reference for | Clean-room reimplementation in Vuqiro | Risk |
|---|---|---|---|---|---|
| Loops (loops-server) | github.com/pixelfed/loops-server | AGPL-3.0 | Short-video product surface: feed types, video lifecycle states, comment/report flows | Video status machine, report→case flow, feed filtering rules | high (copyleft — reference only) |
| PeerTube | github.com/Chocobozzz/PeerTube | AGPL-3.0 | Video processing job states, moderation/abuse reports, appeals | `video_processing_jobs` state machine, abuse-report data model | high (copyleft — reference only) |
| Pixelfed | github.com/pixelfed/pixelfed | AGPL-3.0 | Profile/social graph patterns, discover surface | Profile settings + discovery grouping | high (copyleft — reference only) |
| Mastodon | github.com/mastodon/mastodon | AGPL-3.0 | Moderation queue, account suspension states, appeal workflow, admin roles | Moderation cases/actions/appeals schema + role scoping | high (copyleft — reference only) |
| MediaCMS | github.com/mediacms-io/mediacms | AGPL-3.0 | Encoding pipeline stages, category taxonomy | Categories table + processing stages | high (copyleft — reference only) |
| taktak | github.com/mkhstar/taktak | MIT (but abandoned/unreviewed quality) | TikTok-like UX walkthrough (screens, gestures) | UX only; no code taken | medium |
| Immich | github.com/immich-app/immich | AGPL-3.0 | Upload session + background job design | Upload-session/job tables designed independently | high (copyleft — reference only) |
| Cal.com | github.com/calcom/cal.com | AGPL-3.0 (core) | Admin console UX (tables/filters/impersonation ideas) | Admin UI written from scratch on Vuqiro's own design system | high (copyleft — reference only) |

## Rejected

| Project | Source | License | Reason for rejection |
|---|---|---|---|
| TikTok-clone repos with copied TikTok assets (various) | various GitHub searches | mixed/unclear | Contain TikTok trademarks/assets or no license file — legal risk, no clean license |
| unlicensed "reels clone" gists/tutorial repos | various | none | No license = all rights reserved; cannot copy, low quality |
| revenuecat-sample apps embedding secret keys | various | mixed | Bad security practice; not needed |
| Private projects (Nordklart, Gridex, Resqly, Fakturaportföljen) | private | proprietary | Explicitly excluded by policy |

---

## What was actually ported vs reimplemented in this pass

- **Ported (permissive):** nothing verbatim beyond normal npm dependency
  usage; the FlatList viewability/autoplay pattern (MIT) was already adapted
  in Batch 5 and is documented above.
- **Clean-room:** ads/sponsorship domain (schema, serving, admin), privacy
  request + data export flows, feed session/impression tracking, push
  provider adapter, admin RBAC UI, onboarding flow, counter triggers, all new
  SQL. Copyleft projects informed *what* to build, never *the code*.

## Attribution obligations

- All npm dependencies ship their LICENSE files; no additional NOTICE entries
  are legally required for MIT/ISC deps, but the full list is mirrored in
  `docs/open-source/third-party-notices.md`.
- Apache-2.0 dependencies (`sharp`, Supabase examples): NOTICE requirements
  handled via `NOTICE.md`.
- No copyleft code exists in this repository.
