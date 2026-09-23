/**
 * Daily social creative — one 1080x1350 (4:5) post, rendered from calendar.json.
 *
 *   node render.mjs            # the next unpublished day in state.json
 *   node render.mjs --day 7    # a specific day, without touching state
 *   node render.mjs --all      # every day, for a proof sheet
 *
 * Outputs out/locare-daily-NN-<id>.png and the matching .md post copy.
 *
 * The calendar is the content; this file is only the typography. Everything a
 * post says lives in calendar.json, so changing a claim never means touching
 * layout code, and a claim can be checked without reading JavaScript.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
// In the repo the fonts and wordmarks sit one level up, shared with the banner
// and ad sources. The scheduled run stages everything into one flat folder, so
// look beside this file first — otherwise the render silently falls back to a
// system font and ships a creative that is subtly the wrong typeface.
const ASSETS = existsSync(join(HERE, 'fonts')) ? HERE : join(HERE, '..');
const OUT = join(HERE, 'out');
const W = 1080, H = 1350;

const calendar = JSON.parse(readFileSync(join(HERE, 'calendar.json'), 'utf8'));
const STATE = join(HERE, 'state.json');

// ── palettes ──────────────────────────────────────────────────────────────
// Locare: brand #2D6A8F · dark #1E4A63 · tint #E7EEF3. Four looks so a month
// of posts is recognisably one brand without being the same picture daily.
const SKINS = {
  ledger: {
    bg: `radial-gradient(760px 520px at 84% 8%, rgba(45,106,143,.42), transparent 66%),
         linear-gradient(163deg, #0C2331 0%, #123043 34%, #1A425A 68%, #102B3B 100%)`,
    ink: '#fff', eyebrow: 'rgba(167,204,226,.92)', body: 'rgba(226,238,246,.80)',
    rule: 'rgba(255,255,255,.13)', wordmark: 'wordmark-white.svg',
    url: 'rgba(226,238,246,.72)', motif: '#ffffff', motifOpacity: '.055', corner: 'tr',
  },
  panel: {
    bg: `radial-gradient(820px 560px at 76% 12%, #ffffff 0%, rgba(255,255,255,0) 68%),
         linear-gradient(168deg, #F5F9FC 0%, #EAF2F7 46%, #DDE9F0 100%)`,
    ink: '#0E2230', eyebrow: 'rgba(45,106,143,.86)', body: 'rgba(16,36,50,.72)',
    rule: 'rgba(16,46,66,.14)', wordmark: 'wordmark-brand.svg',
    url: 'rgba(16,36,50,.60)', motif: '#2D6A8F', motifOpacity: '.16', corner: 'tr',
  },
  flow: {
    bg: `radial-gradient(700px 480px at 12% 90%, rgba(45,106,143,.30), transparent 68%),
         linear-gradient(174deg, #070F16 0%, #0A1824 40%, #0C2030 74%, #08131C 100%)`,
    ink: '#fff', eyebrow: 'rgba(140,186,214,.88)', body: 'rgba(219,233,242,.74)',
    rule: 'rgba(255,255,255,.13)', wordmark: 'wordmark-white.svg',
    url: 'rgba(219,233,242,.72)', motif: '#ffffff', motifOpacity: '.05', corner: 'bl',
  },
  statement: {
    bg: `radial-gradient(900px 620px at 50% 0%, rgba(62,140,184,.34), transparent 70%),
         linear-gradient(170deg, #17394E 0%, #1E4A63 42%, #18415A 72%, #102D3E 100%)`,
    ink: '#fff', eyebrow: 'rgba(183,214,232,.92)', body: 'rgba(226,238,246,.80)',
    rule: 'rgba(255,255,255,.14)', wordmark: 'wordmark-white.svg',
    url: 'rgba(226,238,246,.72)', motif: '#ffffff', motifOpacity: '.06', corner: 'tr',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── devices ───────────────────────────────────────────────────────────────
function tableDevice(d) {
  const head = d.columns.map((c, i) => `<th${i ? '' : ' class="l"'}>${esc(c)}</th>`).join('');
  const rows = d.rows.map((r) => `<tr>${r.map((c, i) =>
    `<td${i ? (c === '—' ? ' class="dim"' : '') : ' class="l"'}>${esc(c)}</td>`).join('')}</tr>`).join('');
  const total = d.total ? `<tr class="total">${d.total.map((c, i) =>
    `<td${i ? '' : ' class="l"'}>${esc(c)}</td>`).join('')}</tr>` : '';
  const foot = d.note ? `<div class="balances"><span class="tick">${TICK}</span>${esc(d.note)}</div>` : '';
  return `<div class="ledger">
    <div class="cap"><span>${esc(d.caption[0])}</span><span>${esc(d.caption[1] ?? '')}</span></div>
    <table><tr>${head}</tr>${rows}${total}</table>${foot}
  </div>`;
}

function panelDevice(d) {
  const rows = (d.rows ?? []).map((r) =>
    `<div class="prow"><span>${esc(r[0])}</span><span class="v">${esc(r[1])}</span></div>`).join('');
  const total = d.total
    ? `<div class="ptotal"><span class="lbl">${esc(d.total[0])}</span><span class="amt">${esc(d.total[1])}</span></div>` : '';
  const pill = d.pill ? `<div class="pill">${esc(d.pill)}</div>` : '';
  return `<div class="device">
    <div class="chrome">
      <div class="dots"><i></i><i></i><i></i></div>
      <div class="addr">${LOCK}<span class="host">https://</span>${esc(d.url)}</div>
    </div>
    <div class="page">
      <div class="brandrow">
        <div class="logo">${esc(d.brand.initial)}</div>
        <div class="agency">${esc(d.brand.name)}<span>${esc(d.brand.sub)}</span></div>
        ${pill}
      </div>
      <div class="rule"></div>
      <div class="prows">${rows}</div>
      ${total}
    </div>
  </div>`;
}

function flowDevice(d) {
  const steps = d.steps.map((s, i) => {
    const last = i === d.steps.length - 1;
    const cls = ['step', last ? 'last' : ''].filter(Boolean).join(' ');
    const val = s.value ? `<div class="amt${s.muted ? ' muted' : ''}">${esc(s.value)}</div>` : '<div></div>';
    return `<div class="${cls}"><div class="lbl">${esc(s.label)}<span>${esc(s.sub)}</span></div>${val}</div>`;
  }).join('');
  return `<div class="flow"><div class="rail"></div>${steps}</div>`;
}

function statementDevice(d) {
  const points = d.points.map((p) =>
    `<li><span class="tick sm">${TICK}</span><span>${esc(p)}</span></li>`).join('');
  return `<div class="statement">
    <div class="quote">${esc(d.statement)}</div>
    <ul class="points">${points}</ul>
  </div>`;
}

const DEVICES = { ledger: tableDevice, panel: panelDevice, flow: flowDevice, statement: statementDevice };

const TICK = `<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.4 3.4L11 1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOCK = `<svg width="16" height="20" viewBox="0 0 16 20" fill="none"><rect x="1.2" y="8" width="13.6" height="10.8" rx="3" stroke="#0F6E56" stroke-width="1.8"/><path d="M4.4 8V5.4a3.6 3.6 0 017.2 0V8" stroke="#0F6E56" stroke-width="1.8" stroke-linecap="round"/></svg>`;

function motif(skin) {
  const g = skin.corner === 'bl'
    ? `<g transform="rotate(7 160 1210)"><rect x="-120" y="1020" width="420" height="420" rx="92"/><rect x="-180" y="960" width="540" height="540" rx="118"/><rect x="-240" y="900" width="660" height="660" rx="144"/></g>`
    : `<g transform="rotate(-9 900 170)"><rect x="740" y="10" width="420" height="420" rx="92"/><rect x="680" y="-50" width="540" height="540" rx="118"/><rect x="620" y="-110" width="660" height="660" rx="144"/></g>`;
  return `<svg class="motif" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/></filter></defs>
    <g stroke="${skin.motif}" fill="none" stroke-width="1.6" opacity="${skin.motifOpacity}">${g}</g>
    <rect width="1080" height="1350" filter="url(#grain)" opacity=".045"/>
  </svg>`;
}

function page(entry) {
  const skin = SKINS[entry.layout];
  if (!skin) throw new Error(`day ${entry.day}: unknown layout "${entry.layout}"`);
  // Headline size steps down as the longest line grows, so a long headline
  // reflows instead of running off the 84px margin.
  // Two constraints, not one. Line length decides how big the headline CAN be;
  // the layout decides how big it may be, because a four-step flow or a
  // statement card leaves far less vertical room than a table does. Without the
  // per-layout cap a short headline sets 104px and pushes the footer off.
  const CAP = { ledger: 104, panel: 94, flow: 78, statement: 86 };
  const longest = Math.max(...entry.headline.map((l) => l.length));
  const byLength = longest > 30 ? 74 : longest > 24 ? 84 : longest > 19 ? 94 : 104;
  const size = Math.min(byLength, CAP[entry.layout]);
  const head = entry.headline
    .map((l, i) => (i && entry.softFrom !== undefined && i >= entry.softFrom ? `<em>${esc(l)}</em>` : esc(l)))
    .join('<br>');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'PJS';src:url('${ASSETS}/fonts/pjs-400.woff2') format('woff2');font-weight:400;font-display:block}
  @font-face{font-family:'PJS';src:url('${ASSETS}/fonts/pjs-600.woff2') format('woff2');font-weight:600;font-display:block}
  @font-face{font-family:'PJS';src:url('${ASSETS}/fonts/pjs-800.woff2') format('woff2');font-weight:800;font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  .stage{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:'PJS',sans-serif;
    background:${skin.bg};display:flex;flex-direction:column;padding:92px 84px 78px}
  .motif{position:absolute;inset:0;width:1080px;height:1350px}
  .eyebrow{font-size:17px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:${skin.eyebrow}}
  h1{margin-top:34px;font-size:${size}px;font-weight:800;line-height:1.02;letter-spacing:-.027em;color:${skin.ink}}
  h1 em{font-style:normal;color:${entry.layout === 'panel' ? '#2D6A8F' : 'rgba(255,255,255,.45)'}}
  .body{margin-top:32px;max-width:770px;font-size:26px;line-height:1.56;color:${skin.body}}
  .note{margin-top:18px;margin-bottom:6px;font-size:18px;color:${skin.body};opacity:.6}
  footer{margin-top:auto;padding-top:40px;display:flex;align-items:flex-end;justify-content:space-between;
    border-top:1px solid ${skin.rule}}
  .wm{height:52px;display:block}
  .url{font-size:21px;font-weight:600;letter-spacing:.03em;color:${skin.url}}
  .tick{width:24px;height:24px;border-radius:50%;background:rgba(143,217,190,.16);border:1px solid rgba(143,217,190,.5);
    display:flex;align-items:center;justify-content:center;color:#8FD9BE;flex:none}
  .tick.sm{width:21px;height:21px}

  /* ledger */
  .ledger{margin-top:56px;border-radius:22px;padding:36px 36px 34px;font-variant-numeric:tabular-nums;
    background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.045));
    border:1px solid rgba(255,255,255,.14);box-shadow:0 26px 60px rgba(4,18,28,.42)}
  .ledger .cap{display:flex;justify-content:space-between;font-size:15px;font-weight:600;letter-spacing:.16em;
    text-transform:uppercase;color:rgba(167,204,226,.72);padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.14)}
  table{width:100%;border-collapse:collapse}
  th{font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(167,204,226,.58);
    text-align:right;padding:18px 0 12px}
  th.l{text-align:left}
  td{font-size:24px;color:rgba(238,246,251,.92);text-align:right;padding:17px 0;border-top:1px solid rgba(255,255,255,.07)}
  td.l{text-align:left;font-size:23px;color:rgba(226,238,246,.86)}
  td.dim{color:rgba(226,238,246,.30)}
  tr.total td{border-top:1px solid rgba(255,255,255,.22);padding-top:24px;font-weight:600;color:#fff;font-size:25px}
  tr.total td.l{font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:rgba(167,204,226,.78)}
  .balances{display:flex;align-items:center;gap:12px;margin-top:26px;font-size:20px;font-weight:600;color:#8FD9BE}

  /* panel */
  .device{margin-top:48px}
  .chrome{background:#fff;border-radius:20px 20px 0 0;border:1px solid rgba(16,46,66,.10);border-bottom:none;
    padding:20px 24px;display:flex;align-items:center;gap:18px}
  .dots{display:flex;gap:9px}
  .dots i{width:12px;height:12px;border-radius:50%;background:rgba(16,46,66,.14);display:block}
  .addr{flex:1;display:flex;align-items:center;gap:12px;background:#F1F5F8;border-radius:999px;padding:12px 20px;
    font-size:22px;color:#123043;font-weight:600}
  .addr .host{color:rgba(16,36,50,.45);font-weight:400}
  .page{background:#fff;border:1px solid rgba(16,46,66,.10);border-top:none;border-radius:0 0 20px 20px;
    padding:38px 38px 40px;box-shadow:0 30px 64px rgba(14,44,64,.13)}
  .brandrow{display:flex;align-items:center;gap:18px}
  .logo{width:62px;height:62px;border-radius:16px;background:#0F6E56;display:flex;align-items:center;
    justify-content:center;color:#fff;font-weight:800;font-size:27px}
  .agency{font-size:27px;font-weight:800;color:#12212B}
  .agency span{display:block;font-size:17px;font-weight:400;color:rgba(16,36,50,.46);margin-top:4px}
  .pill{margin-left:auto;background:rgba(15,110,86,.10);color:#0F6E56;font-size:17px;font-weight:600;
    border-radius:999px;padding:9px 18px}
  .rule{height:1px;background:rgba(16,46,66,.10);margin:30px 0 8px}
  .prows{font-variant-numeric:tabular-nums}
  .prow{display:flex;justify-content:space-between;padding:17px 0;font-size:24px;color:rgba(16,36,50,.78)}
  .prow+.prow{border-top:1px solid rgba(16,46,66,.07)}
  .prow .v{font-weight:600;color:#12212B}
  .ptotal{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:26px;
    border-top:1px solid rgba(16,46,66,.18);font-variant-numeric:tabular-nums}
  .ptotal .lbl{font-size:19px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(16,36,50,.42)}
  .ptotal .amt{font-size:34px;font-weight:800;color:#12212B;letter-spacing:-.015em}

  /* flow */
  .flow{margin-top:70px;position:relative;padding-left:46px}
  .rail{position:absolute;left:11px;top:14px;bottom:14px;width:2px;
    background:linear-gradient(180deg,rgba(45,106,143,.15),#2D6A8F 22%,#3E8CB8 78%,rgba(62,140,184,.15))}
  .step{position:relative;display:flex;align-items:baseline;justify-content:space-between;padding:31px 0;
    font-variant-numeric:tabular-nums}
  .step+.step{border-top:1px solid rgba(255,255,255,.075)}
  .step::before{content:'';position:absolute;left:-41px;top:39px;width:13px;height:13px;border-radius:50%;
    background:#0A1824;border:2.5px solid #3E8CB8}
  .step.last::before{background:#3E8CB8;box-shadow:0 0 0 7px rgba(62,140,184,.16)}
  .step .lbl{font-size:27px;font-weight:600;color:#fff}
  .step .lbl span{display:block;margin-top:6px;font-size:18px;font-weight:400;color:rgba(200,222,236,.46)}
  .step .amt{font-size:29px;font-weight:600;color:rgba(238,247,252,.94)}
  .step .amt.muted{color:rgba(200,222,236,.42);font-weight:400;font-size:24px}
  .step.last .amt{color:#8FD9BE}

  /* statement */
  .statement{margin-top:72px;border-radius:22px;padding:52px 44px 48px;
    background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.045));
    border:1px solid rgba(255,255,255,.16);box-shadow:0 26px 60px rgba(4,18,28,.34)}
  .quote{font-size:42px;font-weight:800;line-height:1.26;letter-spacing:-.018em;color:#fff}
  .points{list-style:none;margin-top:38px;display:flex;flex-direction:column;gap:24px}
  .points li{display:flex;align-items:flex-start;gap:16px;font-size:24px;line-height:1.44;color:rgba(226,238,246,.86)}
  .points li .tick{margin-top:2px}
  </style></head><body><div class="stage">
    ${motif(skin)}
    <div class="eyebrow">${esc(entry.eyebrow)}</div>
    <h1>${head}</h1>
    <div class="body">${esc(entry.body)}</div>
    ${DEVICES[entry.layout](entry.device)}
    ${entry.footnote ? `<div class="note">${esc(entry.footnote)}</div>` : ''}
    <footer>
      <img class="wm" src="${ASSETS}/${skin.wordmark}" alt="Locare">
      <div class="url">locare.co.za</div>
    </footer>
  </div></body></html>`;
}

function postCopy(entry) {
  const n = String(entry.day).padStart(2, '0');
  return `# Day ${n} — ${entry.theme}\n\n`
    + `Image: \`locare-daily-${n}-${entry.id}.png\` (1080x1350)\n\n---\n\n`
    + `${entry.copy.hook}\n\n${entry.copy.paras.join('\n\n')}\n\n${entry.copy.close}\n\n`
    + `${entry.hashtags.join(' ')}\n\n---\n\n`
    + `Claim rests on: ${entry.source}\n`;
}

// ── run ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dayArg = argv.includes('--day') ? Number(argv[argv.indexOf('--day') + 1]) : null;
const all = argv.includes('--all');

let entries;
if (all) entries = calendar;
else if (dayArg) entries = [calendar.find((e) => e.day === dayArg)].filter(Boolean);
else {
  let last = 0;
  if (existsSync(STATE)) { try { last = JSON.parse(readFileSync(STATE, 'utf8')).lastDay ?? 0; } catch {} }
  // Wrap rather than stop: a month of posts running out on day 31 would fail
  // silently at 20:00 with nobody watching. Re-running the set is the safer
  // failure, and the log says which pass it is.
  const next = (last % calendar.length) + 1;
  entries = [calendar.find((e) => e.day === next)];
  console.log(`cycle ${Math.floor(last / calendar.length) + 1}, day ${next} of ${calendar.length}`);
}
if (!entries.length || !entries[0]) throw new Error('no calendar entry matched');

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

for (const entry of entries) {
  const n = String(entry.day).padStart(2, '0');
  const html = join(OUT, `.day-${n}.html`);
  writeFileSync(html, page(entry));
  await pg.goto(`file://${html}`, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(320);

  // A creative whose footer is cropped off is worse than no creative, and at
  // 20:00 nobody is looking. Fail loudly instead.
  const over = await pg.evaluate(() => document.querySelector('.stage').scrollHeight - 1350);
  if (over > 1) throw new Error(`day ${n} (${entry.id}) overflows by ${over}px — shorten the body or a device row`);

  const png = join(OUT, `locare-daily-${n}-${entry.id}.png`);
  await pg.screenshot({ path: png, clip: { x: 0, y: 0, width: W, height: H } });
  writeFileSync(join(OUT, `locare-daily-${n}-${entry.id}.md`), postCopy(entry));
  console.log('wrote', png);

  if (!all && !dayArg) writeFileSync(STATE, JSON.stringify({ lastDay: entry.day, at: new Date().toISOString() }, null, 2));
}

await browser.close();
