/**
 * The crawler: every page, as every account, in every language and screen
 * size, checked for the faults a person only notices by looking.
 *
 *   npm run crawl                                  (everything in crawl.config.json)
 *   npm run crawl -- --account owner --locale zh-Hans --viewport desktop --max 20
 *
 * READ-ONLY BY CONSTRUCTION. It follows links and never clicks a button, types,
 * or submits — so it cannot run billing, send a lease or record a payment, and
 * it is safe against the demo data. A page that does something on mere load
 * would be a bug in its own right; add it to `skip` meanwhile.
 *
 * What it checks on each page (severity in brackets):
 *   - sign-in held: not bounced to /login or /no-access                [error]
 *   - renders: not blank, not the 404 page, no Next.js error overlay   [error]
 *   - uncaught exceptions and console errors, incl. hydration          [error]
 *   - API calls answering 4xx/5xx, or failing outright                 [error]
 *   - raw translation keys on screen ("godsEye.noProperties")          [error]
 *   - English left on a non-English build ("active", "fixed")          [error]
 *   - money that is all zero (5+ amounts on the page, every one R 0)  [error]
 *   - links to sections this deployment hides from the menu            [warn]
 *   - horizontal overflow (content wider than the screen)              [warn]
 *   - broken images                                                    [warn]
 *   - slow pages (after the route's first, compiling, visit)           [warn]
 *
 * Sign-in: through the API, reading the one-time code from Mailpit (the
 * stack runs with OTP_CHANNEL=email), then the token and the language go into
 * localStorage before the app loads — so every page starts signed in, in the
 * right language, without touching the login form. Set OTP=123456 to skip
 * Mailpit.
 *
 * Output: .crawl/<timestamp>/report.html (+ findings.json, screenshots).
 * Exit code 1 when there is any error, so it can gate a nightly run.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------- config
const CFG = JSON.parse(readFileSync(resolve('scripts/crawl/crawl.config.json'), 'utf8'));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE = (arg('base') || process.env.BASE_URL || CFG.baseUrl).replace(/\/+$/, '');
const API = (arg('api') || process.env.API_BASE || CFG.apiBase).replace(/\/+$/, '');
const MAILPIT = (arg('mailpit') || CFG.mailpit).replace(/\/+$/, '');
const MAX = Number(arg('max') || CFG.maxPages || 60);
const SAMPLES = Number(CFG.samplesPerPattern || 2);
const SLOW = Number(CFG.slowMs || 4000);
const pick = (all, flag, key = (x) => x) => (arg(flag) ? all.filter((x) => arg(flag).split(',').includes(key(x))) : all);
const ACCOUNTS = pick(CFG.accounts, 'account', (a) => a.label);
const LOCALES = pick(CFG.locales, 'locale');
const VIEWPORTS = pick(Object.keys(CFG.viewports), 'viewport');
const ALLOW = new Set((CFG.allowWords || []).map((w) => w.toLowerCase()));
const SKIP = CFG.skip || [];
const IGNORE_API = (CFG.ignoreApi || []).map((p) => new RegExp(p));

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = resolve('.crawl', STAMP);
mkdirSync(join(OUT, 'shots'), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const pagesSeen = [];
const add = (f) => findings.push(f);

// ---------------------------------------------------------------- sign-in
async function readCodeFromMailpit(email, since) {
  const q = encodeURIComponent(`to:${email} subject:"Your sign-in code"`);
  for (let i = 0; i < 30; i += 1) {
    try {
      const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${q}&limit=5`)).json();
      const fresh = (list.messages || []).find((m) => Date.parse(m.Created) >= since - 2000);
      if (fresh) {
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
        const m = /code is (\d{4,8})/.exec(msg.Text || '') || /(\d{6})/.exec(msg.Text || '');
        if (m) return m[1];
      }
    } catch {
      /* Mailpit not up yet: keep polling */
    }
    await sleep(500);
  }
  throw new Error(`no sign-in code for ${email} in Mailpit (${MAILPIT}) after 15s`);
}

async function signIn(email) {
  const since = Date.now();
  const req = await fetch(`${API}/auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ destination: email }),
  });
  if (!req.ok) throw new Error(`otp/request ${req.status}: ${(await req.text()).slice(0, 200)}`);
  const code = process.env.OTP?.trim() || (await readCodeFromMailpit(email, since));
  const ver = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ destination: email, code }),
  });
  if (!ver.ok) throw new Error(`otp/verify ${ver.status}: ${(await ver.text()).slice(0, 200)}`);
  const { accessToken } = await ver.json();
  if (!accessToken) throw new Error('otp/verify returned no accessToken');
  return accessToken;
}

// ---------------------------------------------------------------- crawl helpers
/** One URL per page TYPE: /leases/3f9a… and /leases/77c1… are the same screen. */
const pattern = (path) =>
  path
    .split('?')[0]
    .split('/')
    .map((s) => (/^[0-9a-f-]{16,}$/i.test(s) || /^\d+$/.test(s) || /^[A-Za-z0-9_-]{20,}$/.test(s) ? ':id' : s))
    .join('/') || '/';

const skipped = (path) => SKIP.some((s) => path === s || path.startsWith(`${s}/`) || path.startsWith(`${s}?`));

/** Everything the page can tell us in one round trip. Runs in the browser. */
function inspectPage({ locale, allow }) {
  const ALLOWED = new Set(allow);
  const out = { textLen: 0, rawKeys: [], english: [], money: { total: 0, zero: 0 }, zeroColumns: [], overflow: 0, brokenImages: [], links: [], nav: [], is404: false, overlay: '' };
  const body = document.body;
  out.textLen = (body?.innerText || '').trim().length;
  out.is404 = /This page could not be found/i.test(body?.innerText || '');
  const portal = document.querySelector('nextjs-portal');
  if (portal?.shadowRoot) {
    const t = portal.shadowRoot.textContent || '';
    if (/Unhandled Runtime Error|Error:|Failed to compile/i.test(t)) out.overlay = t.replace(/\s+/g, ' ').slice(0, 300);
  }

  const visible = (el) => {
    if (!el) return false;
    if (el.closest('script,style,noscript,code,pre,[aria-hidden="true"],.sr-only')) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  const TLD = /\.(com|co|za|demo|test|org|net|io|app|dev|local)\b/i;
  const PARTICLES = new Set(['van', 'der', 'de', 'du', 'le', 'la', 'von', 'da', 'di', 'den', 'ten', 'te']);
  const MONEY = /^-?R\s?\d[\d\s ,.]*$/;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const seenEnglish = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent || '').trim();
    if (!text || !visible(n.parentElement)) continue;
    // A raw catalogue key: lowerCamel segments joined by dots, the whole node.
    if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+){1,5}$/.test(text) && !TLD.test(text)) {
      out.rawKeys.push(text);
      continue; // reported once, as a key — not again as English
    }
    if (MONEY.test(text)) {
      out.money.total += 1;
      const digits = text.replace(/[^\d]/g, '');
      if (/^0*$/.test(digits)) out.money.zero += 1;
    }
    if (locale !== 'en' && !/[㐀-鿿]/.test(text)) {
      const cleaned = text
        .replace(/\S+@\S+/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\b[\w-]+\.(com|co\.za|za|demo|test|org|net|io)\b/gi, ' ');
      const words = cleaned.match(/[A-Za-z][A-Za-z'’-]+/g) || [];
      // Lower-case words are English vocabulary ("active", "fixed"); names and
      // labels (Bauta Villas, Thandi) are capitalised and stay. Particles in
      // surnames (van der Merwe) and the allowlist are not English copy.
      const eng = words.filter((w) => w.length >= 3 && /^[a-z]/.test(w) && !PARTICLES.has(w) && !ALLOWED.has(w.toLowerCase()));
      if (eng.length && !seenEnglish.has(text)) {
        seenEnglish.add(text);
        out.english.push(text.slice(0, 80));
      }
    }
  }

  // A table column of amounts that is entirely zero: the R 0.00 rent column.
  document.querySelectorAll('table').forEach((tbl, ti) => {
    const rows = [...tbl.querySelectorAll('tbody tr')];
    if (rows.length < 5) return;
    const cols = Math.max(...rows.map((r) => r.children.length));
    for (let c = 0; c < cols; c += 1) {
      const cells = rows.map((r) => (r.children[c]?.textContent || '').trim()).filter((t) => MONEY.test(t));
      if (cells.length >= 5 && cells.every((t) => /^0*$/.test(t.replace(/[^\d]/g, '')))) {
        const head = tbl.querySelectorAll('thead th')[c]?.textContent?.trim();
        out.zeroColumns.push(head || `table ${ti + 1}, column ${c + 1}`);
      }
    }
  });

  out.overflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  document.querySelectorAll('img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && visible(img)) out.brokenImages.push(img.getAttribute('src') || '(no src)');
  });
  const internal = (a) => {
    const h = a.getAttribute('href') || '';
    if (!h.startsWith('/') || h.startsWith('//')) return null;
    if (a.getAttribute('download') !== null || /\.(csv|pdf|xlsx|zip)(\?|$)/i.test(h) || h.startsWith('/api/')) return null;
    return h.split('#')[0];
  };
  document.querySelectorAll('nav a[href], aside a[href]').forEach((a) => {
    const h = internal(a);
    if (h) out.nav.push(h);
  });
  document.querySelectorAll('a[href]').forEach((a) => {
    const h = internal(a);
    if (h) out.links.push({ href: h, text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 40) });
  });
  return out;
}

// ---------------------------------------------------------------- one variant
async function crawlVariant(browser, account, token, locale, vpName, firstVisit) {
  const [w, h] = CFG.viewports[vpName];
  const variant = `${account.label} · ${locale} · ${vpName}`;
  const vslug = `${account.label}-${locale}-${vpName}`.replace(/[^\w-]/g, '_');
  const origin = new URL(BASE).origin;
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(
    ([tok, loc, org]) => {
      if (location.origin !== org) return;
      try {
        if (!localStorage.getItem('__crawl_init')) {
          localStorage.setItem('pms_admin_token', tok);
          localStorage.setItem('pms.locale', loc);
          localStorage.setItem('__crawl_init', '1');
        }
      } catch { /* storage refused: the page will show the login, which is reported */ }
    },
    [token, locale, origin],
  );
  const page = await context.newPage();

  const events = [];
  page.on('pageerror', (e) => events.push({ check: 'uncaught-exception', detail: String(e.message).split('\n')[0] }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // A failed API call also logs a console error; the response handler reports
    // it with its status, so skip the duplicate.
    if (/Failed to load resource/.test(t)) return;
    events.push({ check: /hydrat|did not match|server-rendered/i.test(t) ? 'hydration' : 'console-error', detail: t.split('\n')[0].slice(0, 300) });
  });
  page.on('response', (r) => {
    const u = r.url();
    if (!u.startsWith(API) || r.status() < 400) return;
    if (IGNORE_API.some((re) => re.test(u))) return;
    events.push({ check: 'api-error', detail: `${r.request().method()} ${u.replace(API, '')} → ${r.status()}` });
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(API)) events.push({ check: 'api-failed', detail: `${r.method()} ${r.url().replace(API, '')} → ${r.failure()?.errorText}` });
  });

  const queue = ['/'];
  const visited = new Set();
  const perPattern = new Map();
  let navSections = null;
  let count = 0;

  while (queue.length && count < MAX) {
    const path = queue.shift();
    if (visited.has(path) || skipped(path)) continue;
    const pat = pattern(path);
    if ((perPattern.get(pat) || 0) >= SAMPLES) continue;
    visited.add(path);
    perPattern.set(pat, (perPattern.get(pat) || 0) + 1);
    count += 1;
    events.length = 0;

    const t0 = Date.now();
    let navError = '';
    try {
      // 'load', then a bounded wait for the network to settle: a page holding a
      // live stream open never reaches networkidle, and waiting on it would
      // cost a minute a page.
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    } catch (e) {
      navError = String(e.message).split('\n')[0];
    }
    await sleep(400);
    const ms = Date.now() - t0;
    const finalPath = new URL(page.url()).pathname;
    const shot = `shots/${vslug}__${(path.replace(/[^\w]+/g, '_') || 'home').slice(0, 80)}.jpg`;
    await page.screenshot({ path: join(OUT, shot), type: 'jpeg', quality: 60, fullPage: true }).catch(() => {});
    const f = (severity, check, detail) => add({ variant, path, severity, check, detail, shot });

    if (navError) f('error', 'navigation', navError);
    if (/^\/login/.test(finalPath)) f('error', 'bounced-to-login', `landed on ${finalPath}`);
    else if (/^\/no-access/.test(finalPath)) f('error', 'no-access', `landed on ${finalPath}`);

    let info;
    try {
      info = await page.evaluate(inspectPage, { locale, allow: [...ALLOW] });
    } catch (e) {
      f('error', 'inspect', String(e.message).split('\n')[0]);
      continue;
    }
    if (navSections === null && info.nav.length) {
      navSections = new Set(info.nav.map((h) => '/' + (h.split('?')[0].split('/')[1] || '')));
      for (const h of info.nav) if (!visited.has(h)) queue.push(h);
    }
    if (info.is404) f('error', 'not-found', 'Next.js 404 page');
    if (info.overlay) f('error', 'error-overlay', info.overlay);
    if (info.textLen < 50 && !info.is404) f('error', 'blank', `${info.textLen} characters of text`);
    for (const e of events) f('error', e.check, e.detail);
    for (const k of [...new Set(info.rawKeys)]) f('error', 'raw-key', k);
    for (const t of info.english) f('error', 'untranslated', t);
    if (info.money.total >= 5 && info.money.zero === info.money.total) f('error', 'money-all-zero', `${info.money.total} amounts, every one zero`);
    for (const c of info.zeroColumns) f('error', 'zero-column', `column "${c}" is all zero`);
    if (info.overflow > 2) f('warn', 'overflow', `${info.overflow}px wider than the ${w}px screen`);
    for (const s of info.brokenImages) f('warn', 'broken-image', s);
    const routeKey = pattern(path);
    if (firstVisit.has(routeKey) && ms > SLOW) f('warn', 'slow', `${(ms / 1000).toFixed(1)}s to settle`);
    firstVisit.add(routeKey);

    for (const l of info.links) {
      const section = '/' + (l.href.split('?')[0].split('/')[1] || '');
      if (navSections && section !== '/' && !navSections.has(section) && !skipped(l.href)) {
        f('warn', 'hidden-section-link', `"${l.text}" → ${l.href} (not in this deployment's menu)`);
      } else if (!visited.has(l.href) && !skipped(l.href)) {
        queue.push(l.href);
      }
    }
    pagesSeen.push({ variant, path, ms, shot });
    process.stdout.write(`  ${variant}  ${path}  ${(ms / 1000).toFixed(1)}s\n`);
  }
  await context.close();
}

// ---------------------------------------------------------------- report
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function writeReport(started) {
  writeFileSync(join(OUT, 'findings.json'), JSON.stringify({ base: BASE, started, findings, pages: pagesSeen }, null, 2));
  const errors = findings.filter((f) => f.severity === 'error');
  const warns = findings.filter((f) => f.severity === 'warn');
  // Group by check + detail: one console error on forty pages is one problem.
  const groups = new Map();
  for (const f of findings) {
    const k = `${f.severity}|${f.check}|${f.detail}`;
    if (!groups.has(k)) groups.set(k, { ...f, where: [] });
    groups.get(k).where.push(f);
  }
  const rows = [...groups.values()]
    .sort((a, b) => (a.severity === b.severity ? b.where.length - a.where.length : a.severity === 'error' ? -1 : 1))
    .map((g) => `<tr class="${g.severity}"><td><span class="sev">${g.severity}</span></td><td>${esc(g.check)}</td><td>${esc(g.detail)}</td>
      <td>${g.where.slice(0, 6).map((w) => `<a href="${esc(w.shot)}" target="_blank">${esc(w.path)}</a> <small>${esc(w.variant)}</small>`).join('<br>')}${g.where.length > 6 ? `<br><small>+${g.where.length - 6} more</small>` : ''}</td></tr>`)
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><title>Crawl ${STAMP}</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#14161b}h1{margin:0 0 4px}small{color:#8a8f98}
.sum{display:flex;gap:12px;margin:16px 0}.sum div{border:1px solid #e6eaef;border-radius:10px;padding:10px 16px}.sum b{font-size:22px;display:block}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e6eaef;padding:8px;text-align:left;vertical-align:top}
.sev{font-size:11px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:4px}
tr.error .sev{background:#fbebeb;color:#b42318}tr.warn .sev{background:#f9eeda;color:#93370d}a{color:#2d6a8f}</style>
<h1>Crawl report</h1><small>${esc(BASE)} · ${esc(started)} · ${pagesSeen.length} page visits</small>
<div class="sum"><div><b>${errors.length}</b>errors</div><div><b>${warns.length}</b>warnings</div><div><b>${groups.size}</b>distinct problems</div></div>
${groups.size ? `<table><tr><th></th><th>Check</th><th>Detail</th><th>Where (click for screenshot)</th></tr>${rows}</table>` : '<p>Nothing found.</p>'}`;
  writeFileSync(join(OUT, 'report.html'), html);
  return { errors: errors.length, warns: warns.length, distinct: groups.size };
}

// ---------------------------------------------------------------- main
async function main() {
  const started = new Date().toISOString();
  console.log(`\ncrawl: ${BASE}  (${ACCOUNTS.length} accounts × ${LOCALES.length} locales × ${VIEWPORTS.length} viewports, max ${MAX} pages each)\n`);
  const browser = await chromium.launch();
  const firstVisit = new Set();
  try {
    for (const account of ACCOUNTS) {
      let token;
      try {
        token = await signIn(account.email);
      } catch (e) {
        add({ variant: account.label, path: '(sign-in)', severity: 'error', check: 'sign-in', detail: String(e.message), shot: '' });
        console.error(`  sign-in failed for ${account.email}: ${e.message}`);
        continue;
      }
      for (const locale of LOCALES) for (const vp of VIEWPORTS) await crawlVariant(browser, account, token, locale, vp, firstVisit);
    }
  } finally {
    await browser.close();
  }
  const s = writeReport(started);
  console.log(`\n${s.errors} errors, ${s.warns} warnings (${s.distinct} distinct)\nreport: ${join(OUT, 'report.html')}\n`);
  process.exit(s.errors ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
