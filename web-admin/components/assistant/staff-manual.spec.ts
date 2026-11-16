import * as fs from 'fs';
import * as path from 'path';
import { AGENCY_CONTENT, agencyContentFor, searchAgencyContent } from './content-agency';
import { en } from '@shared/i18n/en';

/**
 * The staff help assistant answers from the Staff manual WORD FOR WORD.
 *
 * These checks make that a property of the build rather than a promise:
 *  1. the manual and the generated catalogue agree, both ways, exactly;
 *  2. every screen in the staff menu has help;
 *  3. every figure an answer states still matches the constant in the code it
 *     was taken from — a changed constant fails here, not in front of a client;
 *  4. typed questions land on the right section.
 */

const REPO = path.join(__dirname, '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const MANUAL = read('docs/manuals/Staff-Web-Manual.md');
const t = (key: string) => (en as Record<string, string>)[key] ?? key;

/** Mirrors scripts/build-staff-assistant.mjs `parseManual`, deliberately re-written. */
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim();
function parseManual(md: string) {
  const out: { key: string; section: string; purpose: string; questions: { q: string; a: string }[] }[] = [];
  for (const chunk of md.split(/^## /m).slice(1)) {
    const [heading, ...rest] = chunk.split('\n');
    const body = rest.join('\n');
    const marker = body.match(/^<!-- assistant: (\S+) -->$/m);
    if (!marker) continue;
    let purpose: string | null = null;
    const questions: { q: string; a: string }[] = [];
    for (const p of body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) {
      if (p.startsWith('<') || p.startsWith('>') || p === '---' || p.startsWith('*Runs on')) continue;
      const m = p.match(/^\*\*([^*][^\n]*?\?)\*\* ([\s\S]+)$/);
      if (m) questions.push({ q: plain(m[1]), a: plain(m[2]) });
      else if (purpose === null && !p.startsWith('**')) purpose = plain(p);
    }
    out.push({ key: marker[1], section: heading.trim(), purpose: purpose ?? '', questions });
  }
  return out;
}
const manual = parseManual(MANUAL);
const REBUILD = 'run `node scripts/build-staff-assistant.mjs`';

describe('the assistant says exactly what the manual says', () => {
  it('has one entry per manual section, and no others', () => {
    expect(Object.keys(AGENCY_CONTENT).sort()).toEqual(manual.map((s) => s.key).sort());
  });

  it.each(manual.map((s) => [s.section, s] as const))('%s matches the manual word for word', (_name, s) => {
    const entry = AGENCY_CONTENT[s.key];
    expect(entry).toBeDefined();
    expect(entry.manualSection).toBe(s.section);
    expect(t(entry.purposeKey)).toBe(s.purpose);
    const fromCatalogue = entry.questions.map((q) => ({ q: t(q.qKey), a: t(q.aKey) }));
    // A failure here means the manual changed without a rebuild: ${REBUILD}.
    expect(fromCatalogue).toEqual(s.questions);
  });

  it('never shows markdown, a missing key or an empty answer', () => {
    for (const entry of Object.values(AGENCY_CONTENT)) {
      for (const k of [entry.titleKey, entry.purposeKey, ...entry.questions.flatMap((q) => [q.qKey, q.aKey])]) {
        const v = t(k);
        expect(v).not.toBe(k);
        expect(v.trim().length).toBeGreaterThan(0);
        expect(v).not.toMatch(/\*\*|<!--|`/);
      }
    }
  });

  it('asks every question only once', () => {
    const qs = manual.flatMap((s) => s.questions.map((q) => q.q.toLowerCase()));
    expect(new Set(qs).size).toBe(qs.length);
  });
});

describe('every staff screen has help', () => {
  const shell = read('web-admin/components/shell.tsx');
  const navBlock = shell.slice(shell.indexOf('const NAV:'), shell.indexOf('const PORTAL_NAV'));
  const routes = [...navBlock.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);

  it('found the staff menu', () => {
    expect(routes.length).toBeGreaterThan(15);
  });

  it.each(routes)('%s', (route) => {
    expect(agencyContentFor(route, t as never)).not.toBeNull();
  });
});

describe('figures in answers still match the code', () => {
  const constant = (rel: string, re: RegExp) => {
    const m = read(rel).match(re);
    if (!m) throw new Error(`${rel}: constant not found by ${re} — it moved; update this check and the manual`);
    return m[1];
  };
  const says = (text: string) => expect(MANUAL).toContain(text);

  it('screening cut-offs', () => {
    const ratio = constant('src/modules/listings/screening.ts', /const MIN_RATIO = (\d+);/);
    const good = constant('src/modules/listings/screening.ts', /const GOOD_CREDIT = (\d+);/);
    const poor = constant('src/modules/listings/screening.ts', /const POOR_CREDIT = (\d+);/);
    says(`Income of at least ${ratio} times the rent with a score of ${good} or more recommends approve`);
    says(`income under ${ratio} times the rent or a score below ${poor} recommends decline`);
  });

  it('minimum applicant age', () => {
    says(`Applicants must be ${constant('src/modules/listings/applications.service.ts', /MIN_APPLICANT_AGE = (\d+);/)} or older.`);
  });

  it('portfolio map windows', () => {
    const expiry = constant('src/modules/reporting/portfolio-state.ts', /LEASE_EXPIRY_WINDOW_DAYS = (\d+);/);
    const interval = constant('src/modules/reporting/portfolio-state.ts', /INSPECTION_INTERVAL_DAYS = (\d+);/);
    says(`When it ends within the next ${expiry} days.`);
    says(`Expiring in ${expiry} days`);
    says(`more than ${interval} days ago`);
    says(`more than ${interval} days old`);
  });

  it('bank statement matching window and file size', () => {
    says(`due within ${constant('src/providers/payment/statement-import.ts', /AMOUNT_MATCH_WINDOW_DAYS = (\d+);/)} days of the payment`);
    says(`up to ${constant('src/modules/imports/import-reader.ts', /MAX_IMPORT_BYTES = (\d+) \* 1024 \* 1024;/)} MB`);
  });

  it('upload limits', () => {
    says(`up to ${constant('src/modules/lease-parsing/lease-parsing.controller.ts', /fileSize: (\d+) \* 1024 \* 1024/)} MB`);
    says(`up to ${constant('src/modules/listings/listings.controller.ts', /fileSize: (\d+) \* 1024 \* 1024/)} MB each`);
  });

  it('the renewal form defaults', () => {
    const page = read('web-admin/app/leases/page.tsx');
    const pct = page.match(/setPct\('(\d+)'\)/)?.[1];
    const months = page.match(/setMonths\('(\d+)'\)/)?.[1];
    expect(pct).toBeDefined();
    says(`The form starts at ${pct}% and ${months} months`);
  });

  it('the dashboard lists the worst six', () => {
    const n = read('web-admin/app/page.tsx').match(/const worstFirst = [\s\S]*?\.slice\(0, (\d+)\)/)?.[1];
    expect(n).toBe('6');
    says('The six active leases that owe the most');
  });

  it('rent invoices: the 1st, due on the 7th', () => {
    expect(read('src/modules/billing/billing.scheduler.ts')).toMatch(/pattern: '0 \d+ 1 \* \*'/);
    expect(read('src/modules/billing/billing.scheduler.ts')).toContain('`${period}-07`');
    expect(read('web-admin/app/page.tsx')).toContain('`${period}-07`');
    says('raised automatically early on the 1st of every month, due on the 7th');
  });
});

describe('typed questions land on the right section', () => {
  // Phrased the way staff type, not the way the manual asks.
  const cases: [string, string][] = [
    ['my meter reading was rejected', 'Utilities'],
    ['when do invoices go out', 'Dashboard'],
    ['how do I renew a lease', 'Leases'],
    ['why cant I delete a unit', 'Properties & Units'],
    ['owner statement net fee', 'Owners'],
    ['why is there no pay out button', 'Owners'],
    ['upload bank statement csv', 'Bank statement'],
    ['what does screening recommend', 'Applications'],
    ['sign in code expired', 'Signing in and your account'],
    ['add a colleague', 'Signing in and your account'],
    ['revoke api key', 'API keys'],
    ['listing photos', 'Listings'],
    ['agent commission mark paid', 'Agents'],
    ['inspection sign off deposit', 'Inspections'],
    ['why listings missing from menu', 'How your installation is set up'],
    ['accept proof of payment', 'Payments'],
    ['scanned pdf lease import', 'Import lease'],
    ['rent roll export', 'Reports'],
    ['portfolio map colours', 'Portfolio map'],
  ];
  it.each(cases)('"%s" → %s', (query, section) => {
    const hit = searchAgencyContent(query, t as never);
    expect(hit?.section).toBe(section);
  });

  it('answers where to change the language, from whichever section asks it', () => {
    // Settings and Language both carry this question, with the same answer.
    expect(searchAgencyContent('how do I change the language', t as never)?.a).toMatch(/bottom of the sidebar/);
  });

  it('still says it does not know rather than guessing', () => {
    expect(searchAgencyContent('what is the weather today', t as never)).toBeNull();
  });
});
