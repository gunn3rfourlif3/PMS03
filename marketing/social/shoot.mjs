import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 2560, H = 1440;

const browser = await chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none'] });
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});

for (const v of process.argv.slice(2)) {
  await page.goto(`file://${join(HERE, `banner-${v}.html`)}`, { waitUntil: 'load' });
  // Fonts are @font-face with font-display:block — screenshotting before they
  // resolve silently ships a fallback-font banner that looks almost right.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const out = join(HERE, `locare-banner-${v}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  console.log('wrote', out);
}

await browser.close();
