/**
 * Browser smoke test for the back-office.
 *
 * The video recorder already drives this product with Playwright, but it films
 * rather than asserts — so a screen could break and the pipeline would happily
 * record the breakage. This script walks the same authenticated routes and
 * fails the run when one of them stops rendering.
 *
 * Deliberately small: six assertions over the screens an agency uses daily. It
 * is a smoke test, not a regression suite — the point is that a change which
 * breaks sign-in or empties the rent roll cannot pass unnoticed.
 *
 *   node scripts/smoke/smoke.mjs
 *
 * Needs the dev stack up (.\scripts\start-all.ps1 -Setup) and a seeded Demo
 * Agency. Exits non-zero on the first failed assertion, and prints one line per
 * check saying what it checked rather than only that it passed.
 *
 * Environment:
 *   BASE_URL      back-office origin            (default from video.config.json)
 *   LOGIN_EMAIL   agency owner                  (default from video.config.json)
 *   OTP           skip the log read and use this code
 *   OTP_LOG       file carrying the API's "[OTP] … -> 123456" line
 *
 * The sign-in routine is a deliberate copy of the one in
 * scripts/video/record.mjs rather than an import: the recorder is load-bearing
 * for marketing and not worth refactoring for this. If a third caller ever
 * appears, extract it then.
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CFG = JSON.parse(readFileSync(resolve('scripts/video/video.config.json'), 'utf8'));
const BASE = process.env.BASE_URL || CFG.baseUrl || 'http://localhost:3001';
const EMAIL = process.env.LOGIN_EMAIL || CFG.loginEmail || 'owner@demo.test';
const OTP_LOG = process.env.OTP_LOG || CFG.otpLog || '.video/api.log';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
async function check(what, fn) {
  try {
    await fn();
    console.log(`  ok    ${what}`);
  } catch (e) {
    failures += 1;
    console.error(`  FAIL  ${what}\n          ${e.message.split('\n')[0]}`);
  }
}

/**
 * OTP codes are stored hashed in otp_challenges — the only plaintext copy is the
 * API's console line, which make-video.ps1 tees to .video/api.log. Same trick
 * here, which is what makes an unattended run possible at all.
 */
async function readOtp(email) {
  if (process.env.OTP) return process.env.OTP.trim();
  const file = resolve(OTP_LOG);
  for (let i = 0; i < 20; i += 1) {
    if (existsSync(file)) {
      const text = readFileSync(file, 'utf8');
      const hits = [...text.matchAll(/\[OTP\]\s*(\S+)\s*->\s*(\d{4,8})/g)].filter(
        (m) => m[1].toLowerCase() === email.toLowerCase(),
      );
      if (hits.length) return hits[hits.length - 1][2];
    }
    await sleep(500);
  }
  throw new Error(
    `no [OTP] line for ${email} in ${OTP_LOG} after 10s — ` +
      `is the API running with OTP_CHANNEL=console and its output tee'd to that file?`,
  );
}

async function signIn(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const field = page.locator('input').first();
  await field.waitFor({ state: 'visible', timeout: 20000 });
  await field.fill(EMAIL);
  await page
    .getByText(/send code/i)
    .first()
    .click({ timeout: 10000 })
    .catch(() => page.getByRole('button', { name: /send code/i }).click({ timeout: 5000 }));
  await sleep(2500);

  const code = await readOtp(EMAIL);
  const codeField = page.locator('input').first();
  await codeField.fill(code);
  await page
    .getByText(/verify/i)
    .first()
    .click({ timeout: 10000 })
    .catch(() => page.getByRole('button', { name: /verify/i }).click({ timeout: 5000 }));
  await sleep(3500);
}

/** Routes are stable in this product; labels and classes are not. See beats.config.mjs. */
const ROUTES = ['/leases', '/payments', '/owners', '/reports', '/listings'];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    console.log(`\nsmoke: ${BASE} as ${EMAIL}\n`);
    await signIn(page);

    await check('sign-in reaches the back-office (leases nav present)', async () => {
      await page.locator('a[href="/leases"]').first().waitFor({ state: 'visible', timeout: 15000 });
    });

    for (const route of ROUTES) {
      await check(`${route} renders an authenticated screen`, async () => {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
        // Still signed in: the nav exists and the OTP form does not.
        await page.locator('a[href="/leases"]').first().waitFor({ state: 'visible', timeout: 15000 });
        const sendCode = await page.getByText(/send code/i).count();
        if (sendCode > 0) throw new Error('bounced back to the sign-in form');
        const body = (await page.locator('body').innerText()).trim();
        if (body.length < 50) throw new Error(`page is effectively blank (${body.length} chars)`);
      });
    }

    await check('/payments shows seeded money, not an empty shell', async () => {
      await page.goto(BASE + '/payments', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      const body = await page.locator('body').innerText();
      // The seed deliberately creates a mix of paid, overdue and partly-paid
      // invoices, so a ZAR amount on this screen is the cheapest proof that the
      // ledger reached the page. Without it the screen demos as empty chrome.
      if (!/R\s?\d[\d\s.,]*/.test(body)) throw new Error('no ZAR amount anywhere on the page');
    });
  } finally {
    await browser.close();
  }

  console.log(
    failures === 0
      ? '\nsmoke: all checks passed\n'
      : `\nsmoke: ${failures} check(s) failed\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nsmoke: aborted — ${e.message}\n`);
  process.exit(1);
});
