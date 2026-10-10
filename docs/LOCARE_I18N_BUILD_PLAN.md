# Locare localisation — 9-day build plan

Written 2026-10-10. Owner: Vernon. Mandarin is the first non-English locale;
the point of the work is the switch, not the one language.

## Scope, as decided 2026-10-10

Vernon's requirement, verbatim: *"I want all apps and web-admin — I should be
able to switch to other languages when I create a demo for a different client."*

So the deliverable is a **locale layer across all four surfaces** with a
switcher, plus one filled non-English catalogue (Simplified Chinese) to prove
it. English stays the source of truth; a missing key falls back to English
rather than rendering a key name.

Surfaces, measured 2026-10-10:

| Surface | Stack | Size |
| --- | --- | --- |
| `web-admin` | Next 14.2 App Router, mostly client components | 58 routes, 73 tsx |
| `mobile-tenant` | Expo ~51 / RN 0.74 | 14 tsx |
| `mobile-landlord` | Expo ~51 / RN 0.74 | 10 tsx |
| `marketing` | hand-written static HTML, no build step | 21 html |

## How a run works

1. Read this file. Find the **first day whose box is unticked**. That is today's
   scope, whatever the date is.
2. Read only the files that day lists. Do not grep or search the repo.
3. Do the work. Typecheck the surface the day touches. Do not run the stack,
   install packages beyond what Day 1 decides, seed, or docker.
4. Tick the box, append one line to the log at the bottom, and stop.
5. **Do not commit, push or deploy.** Vernon runs git himself. End by printing
   the `git add` / `git commit` line for the day's files.

If every box is ticked, do nothing and say the plan is complete.

## Standing constraints

Decided 2026-10-10, and not to be relitigated by a run:

- **No i18n library.** A typed message catalogue in plain TypeScript plus a
  ~30-line `t()` is the whole mechanism. `next-intl` would not serve the two
  Expo apps and the static marketing site; three different libraries across
  four surfaces is worse than one shared file. Same reasoning that kept a
  markdown dependency out of the manual route.
- **One shared catalogue, imported by all three code stacks.** Lives in
  `shared/i18n/`. A key defined once is translated once; a surface that needs
  its own wording gets its own key, not its own file.
- **English is the source.** `en` is the only hand-authored catalogue whose
  wording is authoritative. Every other locale is a translation of it, and a
  missing or empty key renders the English string — never `app.nav.utilities`.
- **Locale resolves beside brand, not instead of it.** Default comes from the
  deployment (env, then host), a switcher overrides it, the choice persists per
  user. That is what makes a demo boot in the client's language.
- **Numbers, money and dates are formatted, not translated.** `Intl.NumberFormat`
  and `Intl.DateTimeFormat` against the active locale. **ZAR stays ZAR** — the
  currency does not change with the language, and no run may convert an amount.
- **Out of scope, and each its own decision:** lease agreements, statements,
  invoices, generated PDFs, and outbound email. Those are contractual or
  financial documents; translating one is a legal question, not a UI task. The
  app may be in Mandarin while the lease it produces is in English.
- **Translation quality is demo-grade until reviewed.** No one on this project
  reads Mandarin. Every non-English catalogue carries a header saying it is
  unreviewed machine translation, and no run may claim otherwise. See open
  item (a).

---

## Day 1 — Locale core

Read: `web-admin/lib/deployment.ts`, `web-admin/lib/brand-shared.ts`.

Create `shared/i18n/`: `locales.ts` (the locale list, `en` and `zh-Hans`, with
native names and text direction), `t.ts` (lookup with English fallback and
`{name}`-style interpolation, no framework imports), `format.ts` (money, date,
number via `Intl`, ZAR fixed), and `en.ts` seeded with the shell and nav strings
only — not a full sweep.

Typecheck in isolation. No surface wired up today.

- [x] Done

## Day 2 — Wire web-admin

Read: `web-admin/components/shell.tsx`, `web-admin/app/layout.tsx`,
`web-admin/components/brand-provider.tsx`, `shared/i18n/*`.

Add `LocaleProvider` beside `BrandProvider`, resolving default from
`DEPLOYMENT_LOCALE` then host, overridable and persisted. Add a switcher to the
shell (visible in every nav, including partner and portal). Translate the shell
and `NAV`/`PORTAL_NAV`/`PARTNER_NAV`/`ADMIN_NAV` labels — nothing else yet.

The vertical slice has to work end to end before any string sweep begins.

- [x] Done

## Day 3 — web-admin sweep, part 1

Read: only the files listed. Core operational routes: `/`, `/properties`,
`/leases`, `/payments`, `/statements`, `/utilities`.

Extract every user-visible string to `en.ts` under a per-route key namespace.
Leave a route alone rather than half-converting it, and say which in the log.

- [ ] Done

## Day 4 — web-admin sweep, part 2

Read: only the files listed. `/listings`, `/applications`, `/owners`, `/agents`,
`/providers`, `/reports`, `/documents`, `/inspections`.

Same shape as Day 3.

- [ ] Done

## Day 5 — web-admin sweep, part 3

Read: only the files listed. `/settings`, `/billing`, `/notifications`,
`/messages`, `/api-keys`, the `/portal/*` routes, the `/partner/*` routes and
`components/ui.tsx`.

`components/assistant/content.ts` is **excluded**: it is curated manual copy
under its own no-invention rule, and translating it means translating
`Partner-Manual.md`. Flag it for open item (c), do not touch it.

Completes web-admin. Typecheck, and run both existing specs.

- [ ] Done

## Day 6 — mobile-tenant

Read: `mobile-tenant/App.tsx` and its screens, `shared/i18n/*`.

Metro does not resolve outside the app root by default — the day's first job is
making `shared/i18n` importable (`watchFolders` plus a path alias), and if that
turns out to need a package install, stop and say so rather than vendoring a
copy of the catalogue.

Switcher on the tenant settings screen. Device locale is the default when it
matches a locale we ship.

- [ ] Done

## Day 7 — mobile-landlord

Read: `mobile-landlord/App.tsx` and its screens.

Same as Day 6, and the Metro question is already answered by it.

- [ ] Done

## Day 8 — marketing

Read: `marketing/index.html`, `marketing/privacy.html`, and the directory
listing only.

21 static pages with no build step. The decision this day must make and record:
per-locale copies of each page (`/zh/index.html`) versus one page with a
client-side swap. Per-locale copies are correct for SEO (`hreflang`) and survive
with JavaScript off; the swap avoids 21 duplicate files going stale. Pick one,
say why, and convert `index.html` plus one guide as the pattern — not all 21.

The `guides/` and `demo/` subtrees are explicitly deferred.

- [ ] Done

## Day 9 — Fill zh-Hans, and verify

Read: `shared/i18n/en.ts`, `shared/i18n/*`.

Create `shared/i18n/zh-Hans.ts` covering every key in `en.ts`, with the
unreviewed-translation header the constraints require. Then verify: typecheck
all three code surfaces, both specs green, every `en` key present in `zh-Hans`,
no key referenced in code that is missing from `en`, and no hardcoded English
left in any file a day above converted.

Report drift rather than fixing it silently.

- [ ] Done

---

## Open questions

- (a) **Nobody on this project reads Mandarin.** Day 9 produces usable demo copy
  and a plausible-looking UI, but a native reviewer has to sign off before a
  Mandarin build is shown to a paying client — a mistranslated "terminate lease"
  is worse than an English button. Vernon to decide whether that review happens
  before or after the first demo.
- (b) ~~Variant not chosen.~~ **Confirmed 2026-10-10: Simplified (`zh-Hans`).**
  Traditional (`zh-Hant`) remains a second catalogue against the same keys if it
  is ever wanted; `resolveLocale()` carries a comment saying what has to change
  the moment it exists, because it currently collapses every `zh-*` onto Hans.
- (c) **The assistant panel and the Partner Manual are untranslated**, and
  deliberately excluded on Day 5. `content.ts` answers are bound to the manual
  by a no-invention rule, so translating the panel means translating
  `docs/manuals/Partner-Manual.md` — a 1:1 translation of a document that states
  rates, thresholds and payout dates. That is its own plan and its own review.
- (d) **Documents and email stay English** per the standing constraints. A demo
  in Mandarin that emails an English statement is the expected behaviour, not a
  bug, until someone decides otherwise.

## Log

One line per run: date, day number, what landed, anything left.
2026-10-10 — Day 1. `shared/i18n/`: `locales.ts` (the two shipped locales, native names in their own script, `resolveLocale()` coercing an env var / stored preference / device tag to something we ship and returning the default rather than throwing, as `resolveDeploymentProfile` does), `t.ts` (the whole mechanism — catalogue lookup, English fallback, `{brace}` interpolation, plus `missingKeys()` so Day 9's check and the lookup cannot disagree about "missing"), `format.ts` (`Intl` money/number/percent/date/dateTime/monthLabel, every one wrapped so a formatter throwing in a table row cannot blank the page, and **ZAR hardcoded, not a parameter** — switching language must never restate an agency's balance in another currency), `en.ts` (shell, four nav sets, switcher; nav sets keep separate keys where the English matches, since staff/partner/admin are different audiences a translation may need to distinguish), `zh-Hans.ts` (empty, carrying the unreviewed-machine-translation header the constraints require) and `index.ts`. Framework-free: no `next/*`, no `react-native`, no `window`, because Metro and both Next runtimes import the same files. Typecheck clean. Nothing left.
2026-10-10 — Day 2. web-admin wired end to end. `lib/locale.ts` resolves per request — `DEPLOYMENT_LOCALE` first (the one env var that boots a client demo in their language, which is the whole requirement), then a leading subdomain that is itself a locale we ship; it deliberately does **not** guess a language from a country domain, since `.co.za` is not a language and an agency on a `.cn` domain may well work in English. `components/locale-provider.tsx` mirrors `BrandProvider`: server-resolved initial value so the first HTML is already in the right language, a stored preference winning on mount (read in an effect, not in render — reading localStorage during render is how you get a hydration mismatch React resolves by silently keeping the server's value), `lang`/`dir` set from the active locale rather than the layout's guess, and locale-bound formatters on the context so no component can format against the wrong locale. `useLocale()` throws outside the provider rather than defaulting to English, because a component quietly serving English forever is the bug this layer exists to prevent. `components/locale-switcher.tsx` is a native `<select>` — keyboard- and screen-reader-correct for free, opens the platform picker on a phone, options carry their own colours because the open list is painted by the OS and would otherwise render white-on-white against the dark sidebar — mounted in both the desktop sidebar and the mobile drawer, and hidden while only one locale ships. `shell.tsx`: all four nav sets now carry a `key: MessageKey` instead of a `label` (arrays annotated `readonly NavItem[]`, since inference widens `key` to `string` and stops the union catching a typo), and the deployment chip, sign-out, splash blurb and impersonation banner read the catalogue. The impersonation sentence became one interpolated string rather than a clause split across JSX, because a translator cannot reorder what JSX has already split; the three icon-only mobile buttons gained `aria-label`s now that strings exist for them. Typecheck clean, panel spec 21/21. Left: (i) **`experimental.externalDir: true` is unverified** — `shared/` sits above web-admin's root and Next needs that flag to import it, but `output: 'standalone'` traces its own file set and whether it follows an externalDir import is the one thing a typecheck cannot answer; `npm run build` in web-admin is the test, and if it fails the fallback is to move the catalogue under `web-admin/lib/i18n/` and have Metro reach up instead. (ii) `DEPLOYMENT_LOCALE` is not in any env example or compose file — neither is `DEPLOYMENT_PROFILE`, so I followed the existing convention and added nothing. (iii) `app/demo/page.tsx` still reads the English `DEPLOYMENT_LABELS` while the sidebar chip reads the catalogue; the two must agree until Days 3–5 convert that page, and `deployment.ts` now carries a comment saying so.
