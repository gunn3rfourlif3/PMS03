import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1350;   // 4:5 — the tallest in-feed format Meta allows

// The npm playwright is newer than the browser build in the container, so point
// it at the installed one rather than downloading a matching one.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(HERE).filter((f) => f.startsWith('ad-') && f.endsWith('.html'));

for (const f of files) {
  await page.goto(`file://${join(HERE, f)}`, { waitUntil: 'load' });
  // font-display:block — screenshotting before the faces resolve silently ships
  // a creative set in a fallback font that looks almost right.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);

  // Catch a layout that has overflowed its 1350px canvas rather than shipping
  // a creative with the footer cropped off.
  const over = await page.evaluate(() => document.querySelector('.stage').scrollHeight - 1350);
  if (over > 1) console.warn(`  ! ${f} overflows by ${over}px`);

  // locare- prefix so a re-render overwrites the committed PNG rather than
  // dropping a second copy beside it (same convention as the banners).
  const out = join(HERE, 'locare-' + f.replace(/\.html$/, '.png'));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  console.log('wrote', out, over > 1 ? `(OVERFLOW +${over}px)` : '');
}

await browser.close();
