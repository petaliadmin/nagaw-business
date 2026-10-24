// Renders public/icons/icon.svg to the PNG sizes the web app manifest and
// iOS need. Run after changing the SVG: `node scripts/generate-icons.mjs`
// (from apps/web). The PNGs are committed; this script is not part of the
// build.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const svg = await readFile(join(dir, 'icon.svg'), 'utf8');
const SIZES = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
try {
  for (const [name, size] of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<html><body style="margin:0">${svg.replace(
        '<svg ',
        `<svg width="${size}" height="${size}" `,
      )}</body></html>`,
    );
    await page.screenshot({ path: join(dir, name), omitBackground: false });
    await page.close();
    console.log(`${name} (${size} px)`);
  }
} finally {
  await browser.close();
}
