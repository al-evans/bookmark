#!/usr/bin/env node
/**
 * Rasterizes public/favicon.svg (light) and public/favicon-dark.svg (dark)
 * into every PNG variant referenced by index.html, manifest.json,
 * site.webmanifest, and sw.js.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const svgPath = path.join(publicDir, 'favicon.svg');
const svgDarkPath = path.join(publicDir, 'favicon-dark.svg');

const targets = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-1024.png', size: 1024 },
  { file: 'appicon.png', size: 180 },
  { file: 'appicon-precomposed.png', size: 180 },
  { file: 'appicon-120.png', size: 120 },
  { file: 'appicon-152.png', size: 152 },
  { file: 'appicon-167.png', size: 167 },
  { file: 'appicon-180.png', size: 180 },
  { file: 'appicon-120x120.png', size: 120 },
  { file: 'appicon-152x152.png', size: 152 },
  { file: 'appicon-167x167.png', size: 167 },
  { file: 'appicon-180x180.png', size: 180 },
  { file: 'appicon-120x120-precomposed.png', size: 120 },
  { file: 'appicon-152x152-precomposed.png', size: 152 },
  { file: 'appicon-167x167-precomposed.png', size: 167 },
  { file: 'appicon-180x180-precomposed.png', size: 180 },
  // Unique-path Apple touch icons (iOS Add-to-Home consumes the -precomposed one)
  { file: 'apple-touch-icon-rg-20260520-8.png', size: 180 },
  { file: 'apple-touch-icon-rg-20260520-8-precomposed.png', size: 180 },
  { file: 'reading-app-icon-source.png', size: 1024 },
];

// Dark variants used by browser favicon swap (in-app icon scheme setting).
const darkTargets = [
  { file: 'favicon-32-dark.png', size: 32 },
  { file: 'icon-192-dark.png', size: 192 },
  { file: 'icon-512-dark.png', size: 512 },
  { file: 'apple-touch-icon-rg-20260520-8-dark.png', size: 180 },
  { file: 'apple-touch-icon-rg-20260520-8-dark-precomposed.png', size: 180 },
];

const svg = await readFile(svgPath);
const svgDark = await readFile(svgDarkPath);

for (const { file, size } of targets) {
  const out = path.join(publicDir, file);
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`wrote ${file} (${size}×${size})`);
}

for (const { file, size } of darkTargets) {
  const out = path.join(publicDir, file);
  await sharp(svgDark, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`wrote ${file} (${size}×${size}) [dark]`);
}

// favicon.ico — 32px PNG renamed; most browsers accept PNG-encoded .ico
const icoBuf = await sharp(svg, { density: 384 }).resize(32, 32).png().toBuffer();
await writeFile(path.join(publicDir, 'favicon.ico'), icoBuf);
console.log('wrote favicon.ico (32×32 PNG)');

