#!/usr/bin/env node
// Renders the marketing pages into a locale directory.
//
//   node scripts/marketing-i18n/build.mjs zh-Hans
//
// Writes `marketing/<locale>/<page>` for each page in the build, translating:
//   * visible text nodes,
//   * <title>, meta description and the og: pair,
//   * every string VALUE inside JSON-LD whose text is in the catalogue — which
//     is what keeps the structured data from drifting from the visible copy,
//   * `<html lang>`, the canonical URL, and a reciprocal hreflang pair.
//
// Exits non-zero when coverage is incomplete, and says exactly what is missing.
// A partly-translated marketing page is worse than an English one: it reads as
// broken rather than as untranslated.
import fs from 'node:fs';
import path from 'node:path';
import { JSONLD_PROSE_KEYS, MARKETING, PAGES, eachTextNode, loadStrings, readPage } from './lib.mjs';

const rendered = [];
const locale = process.argv[2];
if (!locale) {
  console.error('usage: build.mjs <locale>   e.g. build.mjs zh-Hans');
  process.exit(2);
}

const SITE = 'https://locare.co.za';
const map = loadStrings(locale);
const norm = (s) => s.replace(/\s+/g, ' ').trim();
/** Catalogue lookup. An empty value counts as untranslated, not as "" . */
const tr = (s) => {
  const v = map[norm(s)];
  return typeof v === 'string' && v.trim() ? v : null;
};

let translated = 0;
const missing = new Set();

/** Replace text nodes back-to-front so earlier offsets stay valid. */
function translateTextNodes(html) {
  const edits = [];
  eachTextNode(html, (text, start, end, raw) => {
    const hit = tr(text);
    if (!hit) { missing.add(norm(text)); return; }
    // Preserve the original node's surrounding whitespace so indentation and
    // inline spacing survive.
    const lead = raw.match(/^\s*/)[0];
    const tail = raw.match(/\s*$/)[0];
    edits.push([start, end, lead + hit + tail]);
    translated += 1;
  });
  let out = html;
  for (const [start, end, value] of edits.reverse()) {
    out = out.slice(0, start) + value + out.slice(end);
  }
  return out;
}

function translateAttr(html, re, wrap) {
  const m = html.match(re);
  if (!m) return html;
  const hit = tr(m[1]);
  if (!hit) { missing.add(norm(m[1])); return html; }
  translated += 1;
  return html.replace(m[0], wrap(hit));
}

/** Translate string values inside every JSON-LD block, in place. */
function translateJsonLd(html) {
  return html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (whole, open, body, close) => {
      let data;
      try { data = JSON.parse(body); } catch { return whole; }
      // Only values whose exact text is in the catalogue are touched: a price,
      // a URL, an @type or a registration number has no catalogue entry and is
      // therefore left alone by construction.
      // Only values under a prose key are candidates — see JSONLD_PROSE_KEYS.
      // A price, a URL, an @type or a registration number is left alone by
      // construction rather than by hoping it has no catalogue entry.
      const walk = (node, key = null) => {
        if (Array.isArray(node)) return node.map((v) => walk(v, key));
        if (node && typeof node === 'object') {
          const out = {};
          for (const [k, v] of Object.entries(node)) out[k] = walk(v, k);
          return out;
        }
        if (typeof node === 'string' && key && JSONLD_PROSE_KEYS.has(key)) {
          const hit = tr(node);
          if (hit) { translated += 1; return hit; }
          // Reported, not skipped: an untranslated structured-data description
          // is the silent divergence this pipeline exists to prevent.
          missing.add(norm(node));
        }
        return node;
      };
      const next = walk(data);
      // inLanguage, where present, should name the rendered language.
      const json = JSON.stringify(next, null, 2).replace(/"inLanguage": "[^"]*"/g, `"inLanguage": "${locale}"`);
      return `${open}\n${json}\n${close}`;
    },
  );
}

for (const rel of PAGES) {
  let html = readPage(rel);

  html = translateAttr(html, /<title>([^<]+)<\/title>/i, (v) => `<title>${v}</title>`);
  html = translateAttr(html, /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i,
    (v) => `<meta name="description" content="${v}" />`);
  html = translateAttr(html, /<meta\s+property="og:title"\s+content="([^"]*)"\s*\/?>/i,
    (v) => `<meta property="og:title" content="${v}" />`);
  html = translateAttr(html, /<meta\s+property="og:description"\s+content="([^"]*)"\s*\/?>/i,
    (v) => `<meta property="og:description" content="${v}" />`);

  html = translateJsonLd(html);
  html = translateTextNodes(html);

  html = html.replace(/<html lang="[^"]*">/i, `<html lang="${locale}">`);

  // Canonical points at THIS locale's URL, and both pages declare the pair, so
  // a crawler can find either from the other. Without the reciprocal pair
  // hreflang is ignored.
  const pageUrl = rel === 'index.html' ? '/' : `/${rel.replace(/\.html$/, '')}`;
  const enUrl = `${SITE}${pageUrl}`;
  const locUrl = `${SITE}/${locale}${pageUrl === '/' ? '/' : pageUrl}`;
  const alternates = [
    `<link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `<link rel="alternate" hreflang="${locale}" href="${locUrl}" />`,
    `<link rel="alternate" hreflang="x-default" href="${enUrl}" />`,
  ].join('\n');
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${locUrl}" />\n${alternates}`);

  // Buffered, not written yet — see the coverage gate below.
  rendered.push([path.join(MARKETING, locale, rel), html]);
}

console.log(`${translated} strings translated`);
if (missing.size) {
  console.error(`\n${missing.size} string(s) have no ${locale} translation:`);
  for (const s of [...missing].slice(0, 20)) console.error(`  · ${s.slice(0, 100)}`);
  if (missing.size > 20) console.error(`  … and ${missing.size - 20} more`);
  console.error(`\nFill them in shared/i18n/marketing/${locale}.json. Re-run to verify.`);
  console.error('Nothing was written: a partly-translated marketing page reads as');
  console.error('broken rather than as untranslated, so incomplete output never lands.');
  process.exit(1);
}

for (const [dest, html] of rendered) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, 'utf8');
  console.log(`wrote ${path.relative(MARKETING, dest)}`);
}
console.log('\ncoverage complete.');
console.log(`Next: add \`COPY ${locale} /srv/${locale}\` to marketing/Dockerfile and the`);
console.log('locale URLs to marketing/sitemap.xml — neither is done until coverage is.');
