#!/usr/bin/env node
// Self-test for the text-node scanner.
//
//   node scripts/marketing-i18n/selftest.mjs
//
// Builds an IDENTITY locale — every English string mapped to itself — and
// checks the rendered page against the source. If the scanner is sound, the
// only differences are the ones the generator means to make: `<html lang>`,
// the canonical/hreflang block, and JSON-LD reserialised by JSON.stringify.
// Any other difference means the scanner mangled the markup, which on a 59KB
// SEO-critical page is the failure that matters most and the one a coverage
// count would not catch.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MARKETING, PAGES, STRINGS_DIR, readPage, writeJson } from './lib.mjs';

const LOCALE = '__selftest';
const inv = JSON.parse(fs.readFileSync(path.join(STRINGS_DIR, 'strings.en.json'), 'utf8'));
const identity = {};
for (const strings of Object.values(inv)) for (const s of strings) identity[s] = s;

const catalogue = path.join(STRINGS_DIR, `${LOCALE}.json`);
writeJson(catalogue, identity);

let failed = 0;
try {
  execFileSync(process.execPath, [path.join(import.meta.dirname, 'build.mjs'), LOCALE], { stdio: 'pipe' });

  for (const rel of PAGES) {
    const src = readPage(rel);
    const out = fs.readFileSync(path.join(MARKETING, LOCALE, rel), 'utf8');

    // Strip the three intended differences from both sides, then compare.
    const strip = (s) => s
      .replace(/<html lang="[^"]*">/i, '<html>')
      .replace(/<link rel="canonical"[^>]*>/i, '')
      .replace(/<link rel="alternate"[^>]*>\s*/gi, '')
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '[JSONLD]')
      .replace(/\s+/g, ' ')
      .trim();

    if (strip(src) === strip(out)) {
      console.log(`ok   ${rel} — markup preserved`);
    } else {
      failed += 1;
      console.error(`FAIL ${rel} — the scanner changed markup it should not have`);
      // Report the first divergence with a little context, which is enough to
      // find the offending node.
      const a = strip(src), b = strip(out);
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
      console.error(`  at char ${i}`);
      console.error(`  source: …${a.slice(Math.max(0, i - 60), i + 60)}…`);
      console.error(`  output: …${b.slice(Math.max(0, i - 60), i + 60)}…`);
    }

    // The JSON-LD must still parse after being rewritten.
    for (const m of out.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch (e) {
        failed += 1;
        console.error(`FAIL ${rel} — JSON-LD no longer parses: ${e.message}`);
      }
    }
  }
} finally {
  fs.rmSync(path.join(MARKETING, LOCALE), { recursive: true, force: true });
  fs.rmSync(catalogue, { force: true });
}

if (failed) process.exit(1);
console.log('\nself-test passed.');
