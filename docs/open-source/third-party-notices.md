# Third-Party Notices

Vuqiro (by Diversa Solutions LLC) includes or depends on the following
open-source software. Each package retains its own license, distributed with
the package inside `node_modules/<name>/LICENSE` and in the published
tarballs. This file is an aggregated notice; see
`docs/open-source/oss-intake-report.md` for the full intake audit.

## Runtime dependencies

| Package | License | Copyright |
|---|---|---|
| hono, @hono/node-server | MIT | Yusuke Wada and Hono contributors |
| @supabase/supabase-js, @supabase/ssr | MIT | Supabase Inc. |
| zod | MIT | Colin McDonnell |
| next | MIT | Vercel, Inc. |
| react, react-dom, react-native | MIT | Meta Platforms, Inc. |
| expo, expo-router, expo-video, expo-image-picker, expo-notifications, expo-status-bar, expo-linking, expo-constants, expo-device | MIT | 650 Industries, Inc. (Expo) |
| react-native-screens, react-native-safe-area-context | MIT | Software Mansion |
| @react-native-async-storage/async-storage | MIT | React Native Community |
| react-native-purchases | MIT | RevenueCat, Inc. |

## Development dependencies

| Package | License | Copyright |
|---|---|---|
| typescript | Apache-2.0 | Microsoft Corporation |
| vitest | MIT | Vitest contributors |
| eslint, @typescript-eslint/* | MIT | ESLint / typescript-eslint contributors |
| prettier | MIT | Prettier contributors |
| tsx | MIT | Hiroki Osame |
| sharp | Apache-2.0 | Lovell Fuller and contributors |

## Design/architecture references (no code included)

The following AGPL-3.0 projects were studied as product references only. No
source code from them is included in this repository:

- Loops (`pixelfed/loops-server`)
- PeerTube (`Chocobozzz/PeerTube`)
- Pixelfed (`pixelfed/pixelfed`)
- Mastodon (`mastodon/mastodon`)
- MediaCMS (`mediacms-io/mediacms`)
- Immich (`immich-app/immich`)

## Pattern attribution

- Vertical feed viewability/autoplay pattern adapted from
  `samuelrvg/react-native-video-feed` (MIT).
- Supabase RLS and storage policy idioms follow the Apache-2.0 licensed
  examples in `supabase/supabase`.
- Expo push delivery follows the publicly documented Expo Push HTTP API.
- Stripe Connect flows follow Stripe's public API reference (`stripe/openapi`,
  MIT).
