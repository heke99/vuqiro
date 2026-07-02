/**
 * Generates the Vuqiro app icon, adaptive icon foreground and splash image
 * from the brand tokens. Original Vuqiro design (violet "V" mark on the
 * dark premium palette) — no third-party branding.
 *
 * Usage: node scripts/generate-app-assets.mjs
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// sharp ships transitively with the Next.js toolchain; resolve it from the
// pnpm store so we don't add a root dependency for a one-shot asset script.
import { readdirSync } from "node:fs";

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    const store = path.join(process.cwd(), "node_modules/.pnpm");
    const dir = readdirSync(store).find((name) => name.startsWith("sharp@"));
    if (!dir) throw new Error("sharp not found; run pnpm install first");
    return require(path.join(store, dir, "node_modules/sharp"));
  }
}

const sharp = loadSharp();

const OUT_DIR = path.join(process.cwd(), "apps/mobile/assets");
mkdirSync(OUT_DIR, { recursive: true });

const colors = {
  background: "#07070A",
  surface: "#101016",
  primary: "#7C3AED",
  secondary: "#22D3EE",
  text: "#F7F7FB"
};

function iconSvg(size, { transparentBg = false } = {}) {
  const half = size / 2;
  const markSize = size * 0.52;
  const radius = size * 0.22;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121026"/>
      <stop offset="55%" stop-color="${colors.background}"/>
      <stop offset="100%" stop-color="#0B0716"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.primary}"/>
      <stop offset="100%" stop-color="#5B21B6"/>
    </linearGradient>
  </defs>
  ${transparentBg ? "" : `<rect width="${size}" height="${size}" fill="url(#bg)"/>`}
  <rect x="${half - markSize / 2}" y="${half - markSize / 2}" width="${markSize}" height="${markSize}"
        rx="${radius}" fill="url(#mark)"/>
  <path d="M ${half - markSize * 0.21} ${half - markSize * 0.17}
           L ${half} ${half + markSize * 0.22}
           L ${half + markSize * 0.21} ${half - markSize * 0.17}"
        stroke="${colors.text}" stroke-width="${markSize * 0.11}" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${half + markSize * 0.31}" cy="${half - markSize * 0.31}" r="${markSize * 0.055}" fill="${colors.secondary}"/>
</svg>`;
}

function splashSvg(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const markSize = Math.min(width, height) * 0.24;
  const radius = markSize * 0.28;
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.7">
      <stop offset="0%" stop-color="#17102B"/>
      <stop offset="100%" stop-color="${colors.background}"/>
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.primary}"/>
      <stop offset="100%" stop-color="#5B21B6"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect x="${cx - markSize / 2}" y="${cy - markSize / 2 - height * 0.03}" width="${markSize}" height="${markSize}"
        rx="${radius}" fill="url(#mark)"/>
  <path d="M ${cx - markSize * 0.21} ${cy - height * 0.03 - markSize * 0.17}
           L ${cx} ${cy - height * 0.03 + markSize * 0.22}
           L ${cx + markSize * 0.21} ${cy - height * 0.03 - markSize * 0.17}"
        stroke="${colors.text}" stroke-width="${markSize * 0.11}" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

async function main() {
  await sharp(Buffer.from(iconSvg(1024))).png().toFile(path.join(OUT_DIR, "icon.png"));
  await sharp(Buffer.from(iconSvg(1024, { transparentBg: true })))
    .png()
    .toFile(path.join(OUT_DIR, "adaptive-icon.png"));
  await sharp(Buffer.from(splashSvg(1284, 2778))).png().toFile(path.join(OUT_DIR, "splash.png"));
  await sharp(Buffer.from(iconSvg(48))).png().toFile(path.join(OUT_DIR, "favicon.png"));
  console.log("Generated icon.png, adaptive-icon.png, splash.png, favicon.png in apps/mobile/assets");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
