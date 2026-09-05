// Rasterizes the brand mark in assets/brand/ into every icon the app serves.
// Run with:
//   npm run icons:generate
//
// The outputs are committed to git on purpose (docs/DECISIONS.md ADR #51): `sharp` is a
// heavy native dependency and App Hosting builds in a clean container on every push, so
// making the build depend on image tooling for assets that change ~never is a bad trade.
// This is a developer tool, not a build step.
//
// The sources are paths-only SVGs with no <text> and no external font, which is what makes
// this reproducible — librsvg would otherwise rasterize text with whatever fonts happen to
// be installed, silently producing different bytes on every machine.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const repoRoot = resolve(import.meta.dirname, "..");
const ICON_SRC = join(repoRoot, "assets/brand/shovarim-icon.svg");
const MASKABLE_SRC = join(repoRoot, "assets/brand/shovarim-icon-maskable.svg");

/** Sizes baked into favicon.ico, smallest first. */
const FAVICON_SIZES = [16, 32, 48];

type PngTarget = { src: string; size: number; out: string };

const PNG_TARGETS: PngTarget[] = [
  // Web app manifest, purpose "any".
  { src: ICON_SRC, size: 192, out: "public/icons/icon-192.png" },
  { src: ICON_SRC, size: 512, out: "public/icons/icon-512.png" },
  // Web app manifest, purpose "maskable" — full-bleed, mark inside the 80% safe zone.
  { src: MASKABLE_SRC, size: 512, out: "public/icons/icon-maskable-512.png" },
  // apple-touch-icon. Built from the maskable (full-bleed) source on purpose: iOS ignores
  // alpha and composites onto black, so a transparent-cornered icon looks broken on the
  // home screen. iOS applies its own corner mask, so we must not pre-round it either.
  { src: MASKABLE_SRC, size: 180, out: "src/app/apple-icon.png" },
];

async function renderPng(src: string, size: number): Promise<Buffer> {
  return sharp(src, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeOut(relativePath: string, data: Buffer): Promise<void> {
  const target = join(repoRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  console.log(`  ${relativePath.padEnd(36)} ${String(data.length).padStart(7)} bytes`);
}

async function main() {
  console.log("Generating icons from assets/brand/…");

  for (const { src, size, out } of PNG_TARGETS) {
    await writeOut(out, await renderPng(src, size));
  }

  // png-to-ico takes one PNG per size and packs them into a single multi-resolution .ico.
  const faviconFrames = await Promise.all(FAVICON_SIZES.map((size) => renderPng(ICON_SRC, size)));
  await writeOut("src/app/favicon.ico", await pngToIco(faviconFrames));

  // The scalable favicon is the source itself — no rasterization involved.
  await writeOut("src/app/icon.svg", await readFile(ICON_SRC));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
