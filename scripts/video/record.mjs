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
const TENANT = process.env.TENANT_URL || CFG.tenantUrl || 'http://localhost:8081';
const LANDLORD = process.env.LANDLORD_URL || CFG.landlordUrl || 'http://localhost:8082';

/** Which app a beat belongs to: where it lives, who signs in, is it a phone. */
const APPS = {
  web:      { origin: BASE,     email: EMAIL,                    mobile: false },
  tenant:   { origin: TENANT,   email: CFG.tenantEmail   || 'thabo@demo.test',       mobile: true },
  landlord: { origin: LANDLORD, email: CFG.landlordEmail || 'sipho@owner.demo.test', mobile: true },
};

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
    await el.waitFor({ state: 'visible', timeout: 2500 });
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
 * Read a log that may not be UTF-8. PowerShell's `*>` redirect writes UTF-16LE,
 * so reading it as UTF-8 yields text with NUL bytes between every character and
 * no regex will ever match. Detect and decode rather than assume.
 */
function readLogText(file) {
  const buf = readFileSync(file);
  if (buf.length >= 2) {
    if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le', 2);   // BOM
    if (buf[0] === 0xfe && buf[1] === 0xff) return buf.swap16().toString('utf16le', 2);
    // No BOM, but PowerShell often omits it — ASCII text as UTF-16LE has a NUL
    // in every second byte.
    const probe = buf.subarray(0, Math.min(buf.length, 200));
    let nuls = 0;
    for (let i = 1; i < probe.length; i += 2) if (probe[i] === 0) nuls++;
    if (nuls > probe.length / 4) return buf.toString('utf16le');
  }
  return buf.toString('utf8');
}

/**
 * The code is only ever plaintext in the API's console line — `otp_challenges`
 * stores it hashed. So: env var, then the tee'd log, then a command, then ask.
 * Locally the API usually runs in its own terminal window that nothing else can
 * read, which is why the log matters.
 */
async function readOtp(email) {
  if (process.env.OTP) return process.env.OTP.trim();

  // Preferred path: poll the tee'd API log. The code is issued a moment after
  // the request, so retry for a few seconds rather than reading once.
  if (OTP_LOG) {
    const file = resolve(OTP_LOG);
    for (let i = 0; i < 20; i++) {
      try {
        const text = readLogText(file);
        const hits = [...text.matchAll(/\[OTP\]\s*(\S+)\s*->\s*(\d{4,8})/g)]
          .filter((m) => m[1].toLowerCase() === email.toLowerCase());
        if (hits.length) return hits[hits.length - 1][2];
      } catch { /* file not written yet */ }
      await sleep(500);
    }
    warn(`no [OTP] line for ${email} in ${OTP_LOG} after 10s`);
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

/**
 * Sign in to any of the three apps. The back-office and both Expo apps share the
 * same passwordless flow — an address field, "Send code", then the 6-digit code —
 * so one routine covers all of them. React Native Web renders TextInput as a real
 * <input> and the Button label as clickable text, which is why the selectors work
 * unchanged across web and mobile.
 */
async function signIn(page, origin, email) {
  log('signing in', email, 'at', origin);
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  // Signing in is also what warms the Metro bundle, so this is the slow one.
  await waitForAppReady(page, origin.includes('808'), '');

  const field = page.locator('input').first();
  await field.waitFor({ state: 'visible', timeout: 20000 });
  await field.fill(email);
  await page.getByText(/send code/i).first().click({ timeout: 10000 })
    .catch(() => page.getByRole('button', { name: /send code/i }).click({ timeout: 5000 }));
  await sleep(2500);

  const code = await readOtp(email);
  if (!code) throw new Error(`Could not obtain an OTP for ${email}.`);
  log('otp', code, 'for', email);

  // The code box is the only visible input once the form advances.
  const codeField = page.locator('input').first();
  await codeField.fill(code);
  await page.getByText(/verify/i).first().click({ timeout: 10000 })
    .catch(() => page.getByRole('button', { name: /verify/i }).click({ timeout: 5000 }));
  await sleep(3500);
  log('signed in', email);
}

/**
 * One authenticated session per app, captured once and reused. Logging in inside
 * a recorded beat would put the OTP dance on camera.
 */
const sessions = new Map();
async function sessionFor(browser, key, origin, email, mobile) {
  if (sessions.has(key)) return sessions.get(key);
  const ctx = await browser.newContext({
    ...(mobile ? devices['iPhone 13 Pro'] : {}),
    viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
  });
  const page = await ctx.newPage();
  let state = undefined;
  try {
    await signIn(page, origin, email);
    state = await ctx.storageState();
  } catch (e) {
    warn(`${key} sign-in failed: ${e.message.split('\n')[0]}`);
    warn(`  ${key} beats will film the login screen instead`);
  }
  await ctx.close();
  sessions.set(key, state);
  return state;
}

/* ── recording ───────────────────────────────────────────────────────────── */

/** Beats that filmed nothing, reported together at the end rather than lost in the scroll. */
const blankBeats = [];

/**
 * Length of a WAV, straight from its header. Avoids shelling out to ffprobe 19
 * times, and the voiceover files are all plain PCM written by our own scripts.
 */
function wavSeconds(file) {
  try {
    const b = readFileSync(file);
    const byteRate = b.readUInt32LE(28);
    if (!byteRate) return 0;
    let off = 12;
    while (off + 8 <= b.length) {
      const id = b.toString('ascii', off, off + 4);
      const size = b.readUInt32LE(off + 4);
      if (id === 'data') return size / byteRate;
      off += 8 + size + (size % 2);
    }
  } catch {
    /* no narration for this beat */
  }
  return 0;
}

/**
 * How long this beat must film for.
 *
 * The assembler gives a beat as many seconds as its narration line needs, but it
 * can only use footage that exists — and the hand-written `wait` values predate
 * the voiceover. Every beat whose line outran its clip got truncated, the voice
 * carried on over the next shot, and the error accumulated: 17.5s of drift by
 * the end of the 120s cut.
 *
 * So the recorder now films for the narration length plus headroom for the parts
 * the assembler trims off the front — blank lead-in, the beat's own in-point, and
 * the settle that guarantees a finished screen on the first frame.
 */
const CLIP_HEADROOM = 6;
function requiredSeconds(id) {
  const secs = wavSeconds(join('docs/video/vo', `${id}.wav`));
  return secs > 0 ? secs + CLIP_HEADROOM : 0;
}

/**
 * Wait until the app has actually PAINTED, not merely loaded.
 *
 * This is the bug that produced a grey rectangle where the tenant and landlord
 * apps should be. Expo serves its HTML shell instantly and then bundles; both
 * `domcontentloaded` and `load` fire long before React Native Web mounts, so the
 * recorder started filming an empty document and every mobile beat came out
 * blank — while every step "succeeded". Gate on real text existing instead.
 *
 * Mobile gets a long timeout because a cold Metro bundle genuinely takes ~30-60s.
 */
async function waitForAppReady(page, isMobile, id = '') {
  const timeout = isMobile ? 90000 : 25000;
  const painted = () =>
    page
      .waitForFunction(
        () => {
          const root = document.querySelector('#root') || document.body;
          const text = (root?.innerText || '').trim();
          return text.length > 20;
        },
        { timeout, polling: 250 },
      )
      .then(() => true)
      .catch(() => false);

  if (await painted()) return true;

  // One reload: the first hit often IS the bundle build, and the second is warm.
  warn(`${id || 'page'}: blank after ${timeout / 1000}s — reloading once`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  if (await painted()) return true;

  warn(`${id || 'page'}: STILL BLANK — this beat will film a grey screen`);
  if (id) blankBeats.push(id);
  return false;
}

/** One browser context per beat, because Playwright writes one video per context. */
async function recordBeat(browser, beat, sessionState) {
  const app = APPS[beat.app || 'web'];
  const isMobile = app.mobile;
  const viewport = isMobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 };
  // Phone footage gets letterboxed into a 1080-tall canvas, so capturing at the
  // logical 390x844 meant upscaling ~1.3x and everything looked soft. Rendering
  // at 2x and recording at 780x1688 means the assembler DOWNscales instead.
  const size = isMobile ? { width: 780, height: 1688 } : viewport;
  const ctx = await browser.newContext({
    ...(isMobile ? devices['iPhone 13 Pro'] : {}),
    viewport,
    deviceScaleFactor: isMobile ? 2 : 1,
    storageState: sessionState,
    recordVideo: { dir: join(OUT, '.tmp'), size },
    colorScheme: 'light',
  });
  const page = await ctx.newPage();
  // A crashed bundle looks exactly like a slow one from the outside, so say which.
  page.on('pageerror', (e) => warn(`${beat.id}: page error — ${String(e).split('\n')[0]}`));
  await installCursor(page);

  const url = beat.goto
    ? (beat.goto.startsWith('http') ? beat.goto : app.origin + beat.goto)
    : app.origin;
  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    // Don't wait on networkidle — Next's HMR websocket means it never fires in
    // dev. Wait for actual painted content instead; a load event is not a mount.
    await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
  }
  await waitForAppReady(page, isMobile, beat.id);
  await installCursor(page);
  await sleep(500);

  // Clock starts once there's something on screen — anything before this is the
  // blank lead-in the assembler trims away, so it mustn't count towards length.
  const shotStart = Date.now();

  let clicked = true;
  for (const step of beat.actions || []) {
    if (step.wait) await sleep(step.wait);
    else if (step.scroll) await smoothScroll(page, step.scroll);
    else if (step.click) clicked = (await clickAt(page, step.click, step.label)) && clicked;
  }

  // A missed nav click would otherwise leave this beat filming the previous
  // screen — visually plausible, silently wrong. Navigate directly instead.
  if (!clicked && beat.fallbackGoto) {
    warn(`${beat.id}: click missed, navigating to ${beat.fallbackGoto} instead`);
    await page.goto(app.origin + beat.fallbackGoto, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await installCursor(page);
    await sleep(1800);
    await smoothScroll(page, 240);
    await sleep(1200);
  }
  // Pad to the intended duration so the clip matches the caption timing.
  await sleep(400);

  // Hold on the finished screen until there is enough footage for the narration.
  // Dwelling on a completed page is harmless; running out of it is not.
  const need = requiredSeconds(beat.id);
  if (need > 0) {
    const short = need * 1000 - (Date.now() - shotStart);
    if (short > 0) {
      log(`${beat.id}: holding ${(short / 1000).toFixed(1)}s more for narration`);
      await sleep(short);
    }
  }

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

  // Sign in once per app that the beats actually reference.
  const needed = [...new Set(BEATS.map((b) => b.app || 'web'))];
  const states = {};
  for (const key of needed) {
    const a = APPS[key];
    states[key] = await sessionFor(browser, key, a.origin, a.email, a.mobile);
  }

  await recordCards(browser);
  const failed = [];
  for (const beat of BEATS) {
    try {
      await recordBeat(browser, beat, states[beat.app || 'web']);
    } catch (e) {
      // One bad beat shouldn't cost the whole run — 20 minutes of stack startup
      // and recording is too much to throw away over a flaky dependency.
      if (beat.optional) warn(`${beat.id} skipped (optional): ${e.message.split('\n')[0]}`);
      else { warn(`${beat.id} FAILED: ${e.message.split('\n')[0]}`); failed.push(beat.id); }
    }
  }

  await browser.close();
  rmSync(join(OUT, '.tmp'), { recursive: true, force: true });

  const files = readdirSync(OUT).filter((f) => f.endsWith('.webm')).sort();
  console.log(`\n${files.length} clips in ${OUT}:`);
  files.forEach((f) => console.log('   ' + f));
  if (failed.length) {
    console.log(`\n${failed.length} beat(s) failed: ${failed.join(', ')}`);
    console.log('Fix the selector in scripts/video/beats.config.mjs and re-run.');
  }
  // Loud, because a blank beat still produces a perfectly valid clip file and a
  // perfectly valid cut. Nothing downstream can tell it apart from real footage.
  if (blankBeats.length) {
    console.log(`\n  ── ${blankBeats.length} BEAT(S) FILMED A BLANK APP ──────────────────────`);
    console.log(`  ${blankBeats.join(', ')}`);
    console.log('  The app never rendered — these clips are a grey rectangle.');
    console.log('  Usually the Expo dev server was still bundling. Load the app');
    console.log('  in a browser once so the bundle is warm, then re-run.');
    console.log('  ────────────────────────────────────────────────────────────');
  }
  console.log('\nNext:  bash scripts/video/assemble.sh\n');
}

main().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });
