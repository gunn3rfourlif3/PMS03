/**
 * Journeys: the crawler's counterpart that DOES click. Each journey drives one
 * real flow through the UI and then checks the outcome end to end — the
 * database total, the emails tenants receive, and that repeating the action
 * does not do it twice.
 *
 *   npm run journey -- billrun                    next unbilled month
 *   npm run journey -- billrun --period 2027-01   a specific month
 *
 * THIS CHANGES DATA. A bill run invoices every active lease of the signed-in
 * agency for that month and emails each tenant. So it refuses to run against
 * anything but localhost unless given --allow-remote, and says what it is
 * about to do before it does it. Run it against the local stack, never
 * production.
 *
 * The bill-run journey, step by step:
 *   1. finds a month with nothing billed yet (or uses --period)
 *   2. reads the expected rent: the sum over every active lease
 *   3. on the dashboard, types the month and clicks Run billing — the real button
 *   4. waits for the background run to finish (the billed total stops moving)
 *   5. billed >= expected rent; the excess is utilities + VAT, and is reported
 *   6. one invoice email per tenant, no tenant emailed twice
 *   7. every email adds up: lines + VAT = total due = the amount-due figure;
 *      greeting has a name; utilities appear when the agency bills them
 *   8. sum of email totals = the billed total in the ledger
 *   9. clicks Run billing AGAIN: nothing new billed, no new emails
 * Output: .crawl/<timestamp>-billrun/report.html, exit 1 on any failure.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { CFG, esc, signIn, signedInContext, sleep } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BARE_FLAGS = new Set(['--allow-remote']);
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) { if (!BARE_FLAGS.has(argv[i])) i += 1; } else positional.push(argv[i]);
}
const JOURNEY = positional[0];
const BASE = (arg('base') || process.env.BASE_URL || CFG.baseUrl).replace(/\/+$/, '');
const API = (arg('api') || process.env.API_BASE || CFG.apiBase).replace(/\/+$/, '');
const MAILPIT = (arg('mailpit') || CFG.mailpit).replace(/\/+$/, '');
const ACCOUNT = CFG.accounts.find((a) => a.label === (arg('account') || 'owner')) || CFG.accounts[0];

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = resolve('.crawl', `${STAMP}-${JOURNEY || 'journey'}`);

/** UI labels come from the catalogue, so a copy change does not break the journey. */
const EN = readFileSync(resolve('shared/i18n/en.ts'), 'utf8');
const label = (key) => {
  const m = new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*'([^']*)'`).exec(EN);
  if (!m) throw new Error(`no English label for ${key}`);
  return m[1];
};

// ------------------------------------------------------------ step recording
const steps = [];
let page;
async function step(name, fn) {
  const t0 = Date.now();
  const rec = { name, ok: true, detail: '', shot: '', ms: 0 };
  steps.push(rec);
  process.stdout.write(`  …     ${name}`);
  try {
    rec.detail = (await fn()) || '';
  } catch (e) {
    rec.ok = false;
    rec.detail = String(e.message || e).split('\n')[0];
  }
  rec.ms = Date.now() - t0;
  if (page) {
    rec.shot = `step-${steps.length}.jpg`;
    await page.screenshot({ path: join(OUT, rec.shot), type: 'jpeg', quality: 60, fullPage: true }).catch(() => (rec.shot = ''));
  }
  process.stdout.write(`\r  ${rec.ok ? 'ok  ' : 'FAIL'}  ${name}${rec.detail ? ` — ${rec.detail}` : ''}\n`);
  return rec.ok;
}
const fail = (msg) => {
  throw new Error(msg);
};

// ------------------------------------------------------------ API + Mailpit
let TOKEN = '';
async function api(path, init = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}
const billed = async (period) => Number((await api(`/reporting/collection/${period}`)).billed || 0);

async function activeLeases() {
  const out = [];
  for (let offset = 0; ; offset += 200) {
    const pg = await api(`/leasing?limit=200&offset=${offset}`);
    out.push(...pg.rows);
    if (out.length >= pg.total || pg.rows.length === 0) return out;
  }
}

/**
 * Mailpit holds every agency's mail, and a run bills every agency, so the
 * signed-in agency's invoices are picked out by the footer each email carries
 * ("<agency> · powered by Locare"). Not the sender name: locally that comes
 * from one global SMTP_FROM_NAME, so every agency's mail claims the same one.
 */
let AGENCY = '';
const detailCache = new Map();
async function detail(id) {
  if (!detailCache.has(id)) detailCache.set(id, await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json());
  return detailCache.get(id);
}
async function invoiceEmails(period) {
  const listed = await listInvoiceEmails(period);
  if (!AGENCY) return listed;
  const mark = `${esc(AGENCY)} &middot; powered by Locare`;
  const keep = [];
  for (let i = 0; i < listed.length; i += 10) {
    const got = await Promise.all(listed.slice(i, i + 10).map((m) => detail(m.ID)));
    got.forEach((d, j) => { if ((d.HTML || '').includes(mark)) keep.push(listed[i + j]); });
  }
  return keep;
}
async function listInvoiceEmails(period) {
  const q = encodeURIComponent(`subject:"Rent invoice for ${period}"`);
  const all = [];
  for (let start = 0; ; start += 250) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${q}&start=${start}&limit=250`)).json();
    all.push(...(r.messages || []));
    if (!r.messages?.length || all.length >= (r.messages_count ?? r.total ?? all.length)) return all;
  }
}

const AMOUNT = /^−?-?R\s?[\d\s ]+\.\d{2}$/;
const rands = (s) => {
  const neg = /^[−-]/.test(s);
  const v = Number(s.replace(/[^\d.]/g, ''));
  return neg ? -v : v;
};

/** Reads one invoice email as a person would: the greeting, the amount due, the lines, the totals. */
async function readInvoiceEmail(browser, id) {
  const msg = await detail(id);
  const p = await browser.newPage();
  await p.setContent(msg.HTML || `<pre>${esc(msg.Text || '')}</pre>`);
  const data = await p.evaluate((AMT) => {
    const re = new RegExp(AMT);
    const rows = [...document.querySelectorAll('tr')]
      .map((tr) => [...tr.children].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
      .filter((c) => c.length === 2 && re.test(c[1]));
    const ps = [...document.querySelectorAll('p')].map((x) => (x.textContent || '').trim());
    const due = [...document.querySelectorAll('div')].find((d) => /^Amount due$/i.test((d.textContent || '').trim()));
    const dueValue = due?.nextElementSibling?.textContent?.trim() || '';
    return { rows, ps, dueValue, text: document.body.innerText };
  }, AMOUNT.source);
  await p.close();
  return { ...data, to: msg.To?.[0]?.Address || '' };
}

/**
 * When a run bills nothing, the reason is in Redis: BullMQ keeps each failed
 * job's error. Read it here so the report names the cause instead of guessing.
 * Uses the local stack's own redis container; says so when it cannot reach it.
 */
function billingQueueDiagnosis() {
  const lua = [
    "local o={}",
    "o[1]='waiting '..redis.call('LLEN','bull:billing:wait')",
    "o[2]='active '..redis.call('LLEN','bull:billing:active')",
    "o[3]='failed '..redis.call('ZCARD','bull:billing:failed')",
    "o[4]='completed '..redis.call('ZCARD','bull:billing:completed')",
    "for _,id in ipairs(redis.call('ZREVRANGE','bull:billing:failed',0,0)) do",
    "  o[#o+1]='last failure: '..tostring(redis.call('HGET','bull:billing:'..id,'failedReason'))",
    "  local st=redis.call('HGET','bull:billing:'..id,'stacktrace')",
    "  if st then o[#o+1]='at: '..string.sub(st,1,600) end",
    "end",
    "for _,id in ipairs(redis.call('ZREVRANGE','bull:billing:completed',0,1)) do",
    "  o[#o+1]='completed job '..id..' '..tostring(redis.call('HGET','bull:billing:'..id,'data'))..' -> '..tostring(redis.call('HGET','bull:billing:'..id,'returnvalue'))",
    "end",
    "return o",
  ].join(' ');
  try {
    const out = execFileSync('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', 'EVAL', lua, '0'], { encoding: 'utf8', timeout: 20000 });
    return out.split('\n').map((l) => l.trim()).filter(Boolean).join(' | ');
  } catch (e) {
    return `could not read the queue from redis (${String(e.message).split('\n')[0]})`;
  }
}

// ------------------------------------------------------------ the bill run
async function billrun(browser) {
  const ctx = await signedInContext(browser, { base: BASE, token: TOKEN, locale: 'en', viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`uncaught: ${e.message.split('\n')[0]}`));
  page.on('response', (r) => {
    if (r.url().startsWith(API) && r.status() >= 400) problems.push(`${r.request().method()} ${r.url().replace(API, '')} → ${r.status()}`);
  });

  let period = arg('period');
  let leases = [];
  let expectedRent = 0;
  let before = 0;
  let after = 0;
  let emails = [];
  let utilitiesOn = false;

  await step('choose a month with nothing billed', async () => {
    if (period) {
      before = await billed(period);
      if (before > 0) fail(`${period} already has R ${before.toFixed(2)} billed — pick an unbilled month, or omit --period`);
      return period;
    }
    const d = new Date();
    for (let i = 0; i < 24; i += 1) {
      const p = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if ((await billed(p)) === 0) {
        period = p;
        return p;
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    fail('no unbilled month in the next 24');
  });
  if (!period) return;

  await step('read the expected rent from the active leases', async () => {
    leases = await activeLeases();
    expectedRent = Math.round(leases.reduce((s, l) => s + Number(l.rent_amount || 0), 0) * 100) / 100;
    const units = new Set(leases.map((l) => l.unit));
    if (units.size < leases.length) fail(`${leases.length} active leases on ${units.size} units — some units have more than one active lease`);
    if (leases.length && expectedRent === 0) fail('every active lease has a rent of 0');
    try { utilitiesOn = !!(await api('/settings/invoicing')).billUtilities; } catch { /* older API */ }
    try {
      const b = await api('/settings/branding');
      AGENCY = (b.logo?.text || b.name || '').trim();
    } catch { /* falls back to every invoice email for the month */ }
    return `${AGENCY || 'agency'}: ${leases.length} active leases, R ${expectedRent.toFixed(2)} rent; utilities ${utilitiesOn ? 'billed' : 'not billed'}`;
  });

  const runButton = () => page.getByRole('button', { name: label('dashboard.runBilling') });
  const clickRun = async () => {
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
    const field = page.getByLabel(label('dashboard.period'));
    await field.waitFor({ state: 'visible', timeout: 20000 });
    await field.fill(period);
    await field.press('Tab');
    const resp = page.waitForResponse((r) => r.url().includes('/billing/run'), { timeout: 20000 });
    await runButton().click();
    const r = await resp;
    if (r.status() >= 400) fail(`the run was refused: ${r.status()} ${(await r.text()).slice(0, 160)}`);
    return r.status();
  };

  if (!(await step(`click Run billing for ${period} on the dashboard`, async () => `accepted (${await clickRun()})`))) return;

  await step('wait for the run to finish', async () => {
    let last = -1;
    let stable = 0;
    for (let i = 0; i < 80; i += 1) {
      await sleep(1500);
      after = await billed(period);
      stable = after > 0 && after === last ? stable + 1 : 0;
      last = after;
      if (stable >= 3) return `R ${after.toFixed(2)} billed`;
    }
    if (after === 0) fail(`nothing billed after 2 minutes. Queue: ${billingQueueDiagnosis()}`);
    return `still moving after 2 minutes; R ${after.toFixed(2)} so far`;
  });

  await step('billed total covers the rent', async () => {
    const extra = Math.round((after - expectedRent) * 100) / 100;
    if (extra < -0.01) fail(`billed R ${after.toFixed(2)} is LESS than the rent R ${expectedRent.toFixed(2)} — some leases were not invoiced`);
    return `rent R ${expectedRent.toFixed(2)} + utilities/VAT R ${extra.toFixed(2)} = R ${after.toFixed(2)}`;
  });

  await step('one invoice email per tenant', async () => {
    const withTenant = leases.filter((l) => l.tenant_id).length;
    let n = -1;
    for (let i = 0; i < 40; i += 1) {
      emails = await invoiceEmails(period);
      if (emails.length === n && n >= withTenant) break;
      n = emails.length;
      await sleep(1500);
    }
    const to = emails.map((m) => (m.To?.[0]?.Address || '').toLowerCase());
    const dupes = to.length - new Set(to).size;
    if (dupes) fail(`${dupes} tenant(s) emailed more than once for ${period}`);
    if (emails.length < withTenant) fail(`${emails.length} emails for ${withTenant} tenanted leases`);
    return `${emails.length} emails, each to a different tenant`;
  });

  await step('every invoice email adds up', async () => {
    const bad = [];
    let sum = 0;
    let withUtilities = 0;
    let unnamed = 0;
    for (let i = 0; i < emails.length; i += 8) {
      const batch = await Promise.all(emails.slice(i, i + 8).map((m) => readInvoiceEmail(browser, m.ID)));
      for (const e of batch) {
        const totalRow = e.rows.find((r) => /^Total due$/i.test(r[0]));
        if (!totalRow) { bad.push(`${e.to}: no "Total due" (old layout?)`); continue; }
        const total = rands(totalRow[1]);
        const vat = e.rows.filter((r) => /^VAT/i.test(r[0])).reduce((s, r) => s + rands(r[1]), 0);
        const sub = e.rows.find((r) => /^Subtotal$/i.test(r[0]));
        const lines = e.rows.filter((r) => !/^(Total due|Subtotal|VAT)/i.test(r[0]));
        const linesSum = lines.reduce((s, r) => s + rands(r[1]), 0);
        if (Math.abs(linesSum + vat - total) > 0.01) bad.push(`${e.to}: lines ${linesSum.toFixed(2)} + VAT ${vat.toFixed(2)} ≠ total ${total.toFixed(2)}`);
        if (sub && Math.abs(rands(sub[1]) - linesSum) > 0.01) bad.push(`${e.to}: subtotal ≠ sum of lines`);
        if (e.dueValue && Math.abs(rands(e.dueValue) - total) > 0.01) bad.push(`${e.to}: amount due ${e.dueValue} ≠ total ${totalRow[1]}`);
        if (lines.some((r) => /^(Electricity|Water|Gas|Sewerage|Refuse)\b/.test(r[0]))) withUtilities += 1;
        const hi = e.ps.find((x) => /^Hi\b/.test(x)) || '';
        if (!/^Hi \S+,$/.test(hi) || /^Hi there,$/.test(hi)) unnamed += 1;
        sum += total;
      }
    }
    sum = Math.round(sum * 100) / 100;
    if (bad.length) fail(`${bad.length} email(s) do not add up — first: ${bad[0]}`);
    if (unnamed) fail(`${unnamed} email(s) greet without a name`);
    if (utilitiesOn && withUtilities === 0) fail('utilities are switched on but no email carries a utility line — no unbilled readings?');
    if (Math.abs(sum - after) > 0.01) fail(`emails total R ${sum.toFixed(2)}, ledger billed R ${after.toFixed(2)} (difference R ${(after - sum).toFixed(2)} — invoices without a tenant email?)`);
    return `${emails.length} emails reconcile to R ${sum.toFixed(2)}; ${withUtilities} carry utilities`;
  });

  await step('click Run billing again: nothing is billed twice', async () => {
    const mailsBefore = emails.length;
    await clickRun();
    await sleep(12000);
    const again = await billed(period);
    const mailsAfter = (await invoiceEmails(period)).length;
    if (Math.abs(again - after) > 0.01) fail(`billed moved from R ${after.toFixed(2)} to R ${again.toFixed(2)}`);
    if (mailsAfter !== mailsBefore) fail(`${mailsAfter - mailsBefore} more invoice emails sent`);
    return 'billed total and email count unchanged';
  });

  await step('no errors on the page during the journey', async () => {
    if (problems.length) fail(`${problems.length}: ${problems[0]}`);
    return 'none';
  });
  await ctx.close();
}

// ------------------------------------------------------------ report + main
function report() {
  const failed = steps.filter((s) => !s.ok).length;
  const rows = steps.map((s) => `<tr class="${s.ok ? 'ok' : 'fail'}"><td>${s.ok ? 'ok' : 'FAIL'}</td><td>${esc(s.name)}</td><td>${esc(s.detail)}</td><td>${(s.ms / 1000).toFixed(1)}s</td><td>${s.shot ? `<a href="${s.shot}" target="_blank">screen</a>` : ''}</td></tr>`).join('');
  writeFileSync(join(OUT, 'report.html'), `<!doctype html><meta charset="utf-8"><title>${esc(JOURNEY)} ${STAMP}</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#14161b}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e6eaef;padding:8px;text-align:left;vertical-align:top}
tr.ok td:first-child{color:#027a48;font-weight:700}tr.fail td:first-child{color:#b42318;font-weight:700}tr.fail{background:#fff6f5}a{color:#2d6a8f}</style>
<h1>Journey: ${esc(JOURNEY)}</h1><p>${esc(BASE)} as ${esc(ACCOUNT.email)} · ${failed ? `<b>${failed} failed</b>` : 'all passed'}</p>
<table><tr><th></th><th>Step</th><th>Result</th><th>Time</th><th></th></tr>${rows}</table>`);
  writeFileSync(join(OUT, 'steps.json'), JSON.stringify(steps, null, 2));
  return failed;
}

const JOURNEYS = { billrun };

async function main() {
  if (!JOURNEYS[JOURNEY]) {
    console.error(`usage: npm run journey -- <${Object.keys(JOURNEYS).join('|')}> [--period YYYY-MM] [--account owner]`);
    process.exit(2);
  }
  const host = new URL(BASE).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !argv.includes('--allow-remote')) {
    console.error(`refusing: ${BASE} is not local. Journeys change data; pass --allow-remote only for a disposable test stack.`);
    process.exit(2);
  }
  mkdirSync(OUT, { recursive: true });
  console.log(`\njourney ${JOURNEY}: ${BASE} as ${ACCOUNT.email}`);
  console.log(`  ! this invoices every active lease of ${ACCOUNT.label}'s agency for the month and emails the tenants (locally: into Mailpit)\n`);
  const browser = await chromium.launch();
  try {
    TOKEN = await signIn({ api: API, mailpit: MAILPIT }, ACCOUNT.email);
    await JOURNEYS[JOURNEY](browser);
  } catch (e) {
    steps.push({ name: 'journey', ok: false, detail: String(e.message || e), shot: '', ms: 0 });
    console.error(`  FAIL  ${e.message}`);
  } finally {
    await browser.close();
  }
  const failed = report();
  console.log(`\n${failed ? `${failed} step(s) failed` : 'all steps passed'}\nreport: ${join(OUT, 'report.html')}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
