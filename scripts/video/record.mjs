/**
 * Locare marketing-video recorder.
 *
 * Drives the real product through the beats in beats.config.mjs and records one
 * video per beat at 1920x1080. A synthetic cursor is drawn into the page and
 * eased between targets, because Playwright's real mouse is invisible to the
 * video encoder — and, usefully, a scripted cursor moves more smoothly than a
 * human hand ever does.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/video/record.mjs
 *
 * Env:
 *   BASE_URL     back-office origin            (default http://localhost:3001)
 *   TENANT_URL   tenant app origin             (default http://localhost:8081)
 *   LOGIN_EMAIL  demo login                    (default owner@demo.test)
 *   OTP_CMD      shell command that prints the API log containing "[OTP] … -> 123456".
 *                Default reads the local compose stack. Set OTP=123456 to skip
 *                the lookup and paste a code manually.
 *   OUT          output directory              (default docs/video/raw)
 *   DEBUG=1      verbose selector reporting
 *
 * The recorder never touches production data — point it at a stack seeded with
 * `npm run seed`, which creates the fictional Demo Agency.
 */
import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync, renameSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { BEATS, CARDS } from './beats.config.mjs';

/** video.config.json holds the environment; env vars win over it. */
function loadConfig() {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'video.config.json');
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return {}; }
}
const CFG = loadConfig();

const BASE = process.env.BASE_URL || CFG.baseUrl || 'http://localhost:3001';
const OUT = resolve(process.env.OUT || CFG.outDir || 'docs/video/raw');
const EMAIL = process.env.LOGIN_EMAIL || CFG.loginEmail || 'owner@demo.test';
const DEBUG = process.env.DEBUG === '1';
const OTP_CMD = process.env.OTP_CMD || '';
// Path to a file the API's stdout is tee'd into. When present the run is fully
// unattended — no prompt, because the code can be read straight out of the log.
const OTP_LOG = process.env.OTP_LOG || CFG.otpLog || '';

const log = (...a) => console.log('·', ...a);
const warn = (...a) => console.warn('!', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── synthetic cursor ────────────────────────────────────────────────────── */

const CURSOR_JS = `
(() => {
  if (window.__cur) return;
  const c = document.createElement('div');
  c.id = '__cursor';
  c.style.cssText = [
    'position:fixed','z-index:2147483647','left:0','top:0','width:22px','height:22px',
    'pointer-events:none','transition:transform .05s linear',
    'background:no-repeat center/contain',
    "background-image:url('data:image/svg+xml;utf8," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 2l14 9-6 1.5L16 20l-3 1.2-3-7.6L5 18z" fill="%23fff" stroke="%23111" stroke-width="1.4" stroke-linejoin="round"/></svg>') + "')",
  ].join(';');
  document.documentElement.appendChild(c);
  const ring = document.createElement('div');
  ring.id = '__cursor_ring';
  ring.style.cssText = 'position:fixed;z-index:2147483646;width:34px;height:34px;border-radius:50%;pointer-events:none;background:rgba(45,106,143,.35);opacity:0;transform:translate(-50%,-50%) scale(.4)';
  document.documentElement.appendChild(ring);
  window.__cur = { c, ring, x: 0, y: 0 };
  window.__curTo = (x, y) => { window.__cur.x = x; window.__cur.y = y; c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
  window.__curTap = (x, y) => {
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
    ring.animate(
      [{ opacity: .9, transform: 'translate(-50%,-50%) scale(.4)' },
       { opacity: 0,  transform: 'translate(-50%,-50%) scale(1.5)' }],
      { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
  };
  window.__curTo(window.innerWidth / 2, window.innerHeight / 2);
})();
`;

async function installCursor(page) {
  await page.addInitScript(CURSOR_JS);
  await page.evaluate(CURSOR_JS).catch(() => {});
}

/** Ease the cursor (and the real mouse, so clicks land) from A to B. */
async function glide(page, to, ms = 620) {
  const from = await page.evaluate(() => (window.__cur ? { x: window.__cur.x, y: window.__cur.y } : { x: 0, y: 0 }));
  const steps = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // easeInOutCubic — starts and stops gently, like a hand does
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const x = from.x + (to.x - from.x) * e;
    const y = from.y + (to.y - from.y) * e;
    await page.evaluate(([x, y]) => window.__curTo && window.__curTo(x, y), [x, y]);
    await page.mouse.move(x, y);
    await sleep(16);
  }
}

async function clickAt(page, selector, label) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    warn(`selector not found: ${label || selector} — beat will continue without the click`);
    if (DEBUG) warn('   tried:', selector);
    return false;
  }
  const box = await el.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await glide(page, { x, y });
  await page.evaluate(([x, y]) => window.__curTap && window.__curTap(x, y), [x, y]);
  await sleep(120);
  await el.click({ timeout: 5000 }).catch(() => warn(`click failed: ${label || selector}`));
  return true;
}

async function smoothScroll(page, amount) {
  const steps = 22;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, amount / steps);
    await sleep(22);
  }
}

/* ── login (passwordless OTP) ────────────────────────────────────────────── */

/**
 * The code is only ever plaintext in the API's console line — `otp_challenges`
 * stores it hashed. So: env var, then a log-scraping command, then just ask.
 * Locally the API usually runs in its own terminal window that nothing else can
 * read, which makes the prompt the normal path rather than the fallback.
 */
async function readOtp() {
  if (process.env.OTP) return process.env.OTP.trim();

  // Preferred path: poll the tee'd API log. The code is issued a moment after
  // the request, so retry for a few seconds rather than reading once.
  if (OTP_LOG) {
    const file = resolve(OTP_LOG);
    for (let i = 0; i < 20; i++) {
      try {
        const text = readFileSync(file, 'utf8');
        const hits = [...text.matchAll(/\[OTP\]\s*(\S+)\s*->\s*(\d{4,8})/g)]
          .filter((m) => m[1].toLowerCase() === EMAIL.toLowerCase());
        if (hits.length) return hits[hits.length - 1][2];
      } catch { /* file not written yet */ }
      await sleep(500);
    }
    warn(`no [OTP] line for ${EMAIL} in ${OTP_LOG} after 10s`);
    warn('is the API running with OTP_CHANNEL=console and its output tee\'d to that file?');
  }

  if (process.env.OTP_CMD) {
    try {
      const out = execSync(OTP_CMD, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const matches = [...out.matchAll(/\[OTP\][^\n]*->\s*(\d{4,8})/g)];
      if (matches.length) return matches[matches.length - 1][1];
      warn('no [OTP] line found. Is OTP_CHANNEL=console on the target stack?');
    } catch (e) {
      warn('OTP_CMD failed:', e.message.split('\n')[0]);
    }
  }

  if (stdin.isTTY) {
    console.log('\n  Look in the API window for a line like:  [OTP] owner@demo.test -> 123456');
    const rl = createInterface({ input: stdin, output: stdout });
    const code = (await rl.question('  Enter the code: ')).trim();
    rl.close();
    if (/^\d{4,8}$/.test(code)) return code;
    warn('that does not look like a code');
  }
  return null;
}

async function login(page) {
  log('signing in as', EMAIL);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input').first().fill(EMAIL);
  await page.getByRole('button', { name: /send code/i }).click();
  await sleep(2500); // let the OTP be issued and logged

  const code = await readOtp();
  if (!code) {
    throw new Error(
      'Could not obtain an OTP.\n' +
      '  Run again with OTP=123456, reading the code from the API window,\n' +
      '  or set OTP_CMD to a command that prints a log containing "[OTP] ... -> code".',
    );
  }
  log('otp', code);
  await page.locator('input').first().fill(code);
  await page.getByRole('button', { name: /verify/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
  log('signed in');
}

/* ── recording ───────────────────────────────────────────────────────────── */

/** One browser context per beat, because Playwright writes one video per context. */
async function recordBeat(browser, beat, storageState) {
  const isMobile = beat.device === 'mobile';
  const size = isMobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 };
  const ctx = await browser.newContext({
    ...(isMobile ? devices['iPhone 13 Pro'] : {}),
    viewport: size,
    deviceScaleFactor: 1,
    storageState: isMobile ? undefined : storageState,
    recordVideo: { dir: join(OUT, '.tmp'), size },
    colorScheme: 'light',
  });
  const page = await ctx.newPage();
  await installCursor(page);

  const url = beat.goto
    ? (beat.goto.startsWith('http') ? beat.goto : BASE + beat.goto)
    : null;
  if (url) await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await installCursor(page);
  await sleep(600);

  for (const step of beat.actions || []) {
    if (step.wait) await sleep(step.wait);
    else if (step.scroll) await smoothScroll(page, step.scroll);
    else if (step.click) await clickAt(page, step.click, step.label);
  }
  // Pad to the intended duration so the clip matches the caption timing.
  await sleep(400);

  const video = page.video();
  await ctx.close();                       // must close before the file is finalised
  const src = await video.path();
  const dest = join(OUT, `${beat.id}.webm`);
  renameSync(src, dest);
  log('recorded', beat.id);
}

async function recordCards(browser) {
  const cards = resolve('docs/video/brand-cards.html');
  if (!existsSync(cards)) { warn('brand-cards.html not found, skipping cards'); return; }
  for (const card of CARDS) {
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: join(OUT, '.tmp'), size: { width: 1920, height: 1080 } },
    });
    const page = await ctx.newPage();
    await page.goto('file://' + cards);
    await page.keyboard.press('h');            // hide the operator hint bar
    await sleep(300);
    await page.keyboard.press(card.key);
    await sleep(card.seconds * 1000);
    const video = page.video();
    await ctx.close();
    renameSync(await video.path(), join(OUT, `${card.id}.webm`));
    log('recorded', card.id);
  }
}

async function main() {
  rmSync(join(OUT, '.tmp'), { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
  });

  // Log in once, reuse the session across beats.
  const authCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const authPage = await authCtx.newPage();
  await login(authPage);
  const storageState = await authCtx.storageState();
  await authCtx.close();

  await recordCards(browser);
  for (const beat of BEATS) await recordBeat(browser, beat, storageState);

  await browser.close();
  rmSync(join(OUT, '.tmp'), { recursive: true, force: true });

  const files = readdirSync(OUT).filter((f) => f.endsWith('.webm')).sort();
  console.log(`\n${files.length} clips in ${OUT}:`);
  files.forEach((f) => console.log('   ' + f));
  console.log('\nNext:  bash scripts/video/assemble.sh\n');
}

main().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });
