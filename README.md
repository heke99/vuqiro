# Vuqiro

Vuqiro is a global short-video creator platform by **Diversa Solutions LLC**.

This repository contains the first product foundation batch:

- `apps/mobile` — Expo React Native mobile app foundation
- `apps/admin` — Next.js superadmin/admin foundation
- `packages/types` — shared product types
- `packages/mock-data` — mock product data for mobile/admin
- `packages/ui` — shared design tokens
- `docs` — product, architecture, legal and implementation documents

Vuqiro is **not** a TikTok clone. It uses its own name, product identity, design system, monetization model and architecture.

## Local setup

From a new local folder:

```bash
git clone https://github.com/heke99/vuqiro.git ~/Desktop/Projects/vuqiro
cd ~/Desktop/Projects/vuqiro
```

Then copy or sync the batch files into that folder. After the files are in place:

```bash
pnpm install
pnpm dev:mobile
```

In a second terminal:

```bash
pnpm dev:admin
```

## Useful commands

```bash
pnpm lint
pnpm typecheck
pnpm format
pnpm fetch:references
```

## Mobile app

```bash
pnpm dev:mobile
```

For a proper native test build later:

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Admin app

```bash
pnpm dev:admin
```

## Open source usage

Open-source references are documented in `docs/legal/source-usage.md`.

GPL/AGPL projects are reference-only unless Diversa Solutions LLC makes a separate written license decision. MIT dependencies may be used if documented and technically appropriate.
