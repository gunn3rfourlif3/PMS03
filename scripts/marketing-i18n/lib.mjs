// Shared helpers for the marketing-site locale pipeline.
//
// THE DESIGN, and why it is neither of the two options the build plan named.
//
// The plan offered per-locale copies of each page, or one page with a
// client-side swap. For THIS site both are wrong, and `index.html` says why in
// its own comment: it carries a JSON-LD FAQPage that must stay in sync with the
// visible copy, "divergence is a manual-action risk". A client-side swap leaves
// the structured data describing English text while the page shows Chinese —
// exactly that divergence, on the page where it costs most. And hand-written
// per-locale copies of an 822-line SEO-critical page, in a directory whose
// guides are regenerated weekly by a content agent, drift the day after they
// are made.
//
// So: ONE English source, kept as the only hand-edited copy, and a generator
// that writes per-locale static pages from it. That gives pre-rendered pages
// (correct for `hreflang`, works with JavaScript off, indexable) with no second
// copy to maintain and no runtime cost. It needs no build step the site did not
// have — these are plain Node scripts, zero dependencies.
//
// Translations are keyed by the ENGLISH SOURCE TEXT rather than by a
// `data-i18n` attribute added to the markup. That means:
//   * the source pages are never touched, so the live English site cannot be
//     broken by this pipeline;
//   * the weekly content agent needs to know nothing about i18n;
//   * JSON-LD values translate from the same map as the visible copy, so the
//     structured data cannot drift from what the page shows — the risk above is
//     structurally gone rather than merely watched;
//   * and a reworded English string loses its translation — which is the real
//     cost of this approach. It is made LOUD rather than silent: the build
//     reports every unmatched string and every node it could not translate, and
//     exits non-zero when coverage is incomplete.

import fs from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const MARKETING = path.join(REPO_ROOT, 'marketing');
export const STRINGS_DIR = path.join(REPO_ROOT, 'shared', 'i18n', 'marketing');

/**
 * Pages in the locale build.
 *
 * Deliberately NOT every html file under `marketing/`. `social/` is ad
 * creative, `internal/` is not public, `demo/` and the `guides/` bodies are
 * deferred by the build plan, and `tools/` is calculator UI that needs its own
 * pass. One guide is included as the pattern the rest would follow.
 */
export const PAGES = [
  'index.html',
  'guides/popia-for-letting-agents.html',
];

/** Elements whose text is markup or data, never prose. */
const SKIP_ELEMENTS = new Set(['script', 'style', 'noscript', 'svg', 'code', 'pre']);

/**
 * Walk a document's translatable text nodes.
 *
 * A hand-rolled scanner rather than a DOM parser: adding `jsdom` or `cheerio`
 * would be the dependency the plan says to avoid, and the shapes here are
 * narrow enough to scan safely. `cb(text, start, end)` is called for each
 * candidate, in source order.
 */
export function eachTextNode(html, cb) {
  const skipRanges = [];
  for (const el of SKIP_ELEMENTS) {
    const re = new RegExp(`<${el}\\b[^>]*>[\\s\\S]*?</${el}>`, 'gi');
    let m;
    while ((m = re.exec(html))) skipRanges.push([m.index, m.index + m[0].length]);
  }
  const inSkip = (i) => skipRanges.some(([a, b]) => i >= a && i < b);

  // Text nodes are whatever sits between a `>` and the next `<`.
  const re = />([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const start = m.index + 1;
    const raw = m[1];
    if (inSkip(start)) continue;
    const text = raw.trim();
    if (!text) continue;
    // Needs at least two consecutive letters to be prose: skips "·", "→",
    // "15%", bare numbers and punctuation-only separators.
    if (!/[A-Za-z]{2}/.test(text)) continue;
    cb(text, start, start + raw.length, raw);
  }
}

/** Attributes whose VALUE is prose a reader or a crawler sees. */
export const TEXT_ATTRS = [
  ['title', /<title>([^<]+)<\/title>/i],
  ['description', /<meta\s+name="description"\s+content="([^"]*)"/i],
  ['og:title', /<meta\s+property="og:title"\s+content="([^"]*)"/i],
  ['og:description', /<meta\s+property="og:description"\s+content="([^"]*)"/i],
];

export const readPage = (rel) => fs.readFileSync(path.join(MARKETING, rel), 'utf8');

export function loadStrings(locale) {
  const p = path.join(STRINGS_DIR, `${locale}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * JSON-LD keys whose string value is PROSE a crawler shows a reader.
 *
 * Added after a probe run caught the gap this list closes: the generator used
 * to translate only JSON-LD values that were byte-identical to a visible
 * string, and the structured data has descriptions of its own that are not on
 * the page — so a locale build left them in English while the visible copy was
 * translated. That is exactly the divergence `index.html`'s own comment warns
 * about. These keys are now part of the translator's inventory.
 *
 * Everything NOT listed here is left alone by construction: `@type`, `@id`,
 * `url`, `logo`, `email`, `price`, `priceCurrency`, `unitCode`,
 * `operatingSystem`, `applicationCategory`, a CIPC registration number. A
 * price or a statute reference cannot be translated by accident.
 */
export const JSONLD_PROSE_KEYS = new Set([
  'name', 'legalName', 'description', 'text', 'headline', 'alternateName',
]);

/** Walk the prose strings in a parsed JSON-LD graph. `cb(text)` per value. */
export function eachJsonLdProse(node, cb, key = null) {
  if (Array.isArray(node)) { for (const v of node) eachJsonLdProse(v, cb, key); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) eachJsonLdProse(v, cb, k);
    return;
  }
  if (typeof node === 'string' && key && JSONLD_PROSE_KEYS.has(key)) cb(node);
}

/** Every JSON-LD block in a document, parsed. Unparseable blocks are skipped. */
export function eachJsonLdBlock(html, cb) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    cb(data);
  }
}
