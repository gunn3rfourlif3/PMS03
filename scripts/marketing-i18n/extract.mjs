#!/usr/bin/env node
// Builds the translator's inventory: every translatable string on the pages in
// the locale build, in source order, written to
// `shared/i18n/marketing/strings.en.json`.
//
// This file is GENERATED and regenerable — it is the checklist a translator
// works from, not a source of truth. English lives in the pages themselves.
//
//   node scripts/marketing-i18n/extract.mjs
import path from 'node:path';
import { PAGES, STRINGS_DIR, TEXT_ATTRS, eachJsonLdBlock, eachJsonLdProse, eachTextNode, readPage, writeJson } from './lib.mjs';

const out = {};
let total = 0;

for (const rel of PAGES) {
  const html = readPage(rel);
  const strings = [];
  const seen = new Set();
  const add = (s) => {
    const text = s.replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    strings.push(text);
  };

  for (const [, re] of TEXT_ATTRS) {
    const m = html.match(re);
    if (m) add(m[1]);
  }
  eachTextNode(html, (text) => add(text));
  // JSON-LD prose. Included so the structured data translates from the same
  // catalogue as the visible copy and cannot diverge from it.
  eachJsonLdBlock(html, (data) => eachJsonLdProse(data, add));

  out[rel] = strings;
  total += strings.length;
  console.log(`${rel}: ${strings.length} strings`);
}

writeJson(path.join(STRINGS_DIR, 'strings.en.json'), out);
console.log(`\n${total} strings → shared/i18n/marketing/strings.en.json`);
