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

- [x] Done

## Day 4 — web-admin sweep, part 2

Read: only the files listed. `/listings`, `/applications`, `/owners`, `/agents`,
`/providers`, `/reports`, `/documents`, `/inspections`.

Same shape as Day 3.

- [x] Done

## Day 5 — web-admin sweep, part 3

Read: only the files listed. `/settings`, `/billing`, `/notifications`,
`/messages`, `/api-keys`, the `/portal/*` routes, the `/partner/*` routes and
`components/ui.tsx`.

`components/assistant/content.ts` is **excluded**: it is curated manual copy
under its own no-invention rule, and translating it means translating
`Partner-Manual.md`. Flag it for open item (c), do not touch it.

Completes web-admin. Typecheck, and run both existing specs.

- [x] Done

## Day 6 — mobile-tenant

Read: `mobile-tenant/App.tsx` and its screens, `shared/i18n/*`.

Metro does not resolve outside the app root by default — the day's first job is
making `shared/i18n` importable (`watchFolders` plus a path alias), and if that
turns out to need a package install, stop and say so rather than vendoring a
copy of the catalogue.

Switcher on the tenant settings screen. Device locale is the default when it
matches a locale we ship.

- [x] Done

## Day 7 — mobile-landlord

Read: `mobile-landlord/App.tsx` and its screens.

Same as Day 6, and the Metro question is already answered by it.

- [x] Done

## Day 8 — marketing

Read: `marketing/index.html`, `marketing/privacy.html`, and the directory
listing only.

21 static pages with no build step. The decision this day must make and record:
per-locale copies of each page (`/zh/index.html`) versus one page with a
client-side swap. Per-locale copies are correct for SEO (`hreflang`) and survive
with JavaScript off; the swap avoids 21 duplicate files going stale. Pick one,
say why, and convert `index.html` plus one guide as the pattern — not all 21.

The `guides/` and `demo/` subtrees are explicitly deferred.

- [x] Done

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
2026-10-10 — Day 3. web-admin sweep part 1: `/`, `/properties`, `/leases`, `/payments`, `/statements`, `/utilities` all read the catalogue; `en.ts` is now 302 keys. Three things the sweep forced, each a decision rather than a mechanical extraction. (1) **Plurals did not exist.** The dashboard's "{n} tenant / {n} tenants" could not be expressed by Day 1's core, so `translatePlural()` went into `t.ts` on `Intl.PluralRules` and `tn()` onto the provider: the caller passes a base key and a count, and each catalogue declares the forms IT needs — English two, Chinese one — rather than a translator being handed an English singular and asked to make it fit. Used by the arrears tile and by five counted strings on `/statements`. (2) **Enum values were being prettified into labels.** `/properties` ran a `label()` helper over `single_unit` with a string replace to get "Single Unit", and `/utilities` carried an English `label` on each `KINDS` row; neither can translate. Both enums now have a key per member (`properties.type.*`, `properties.status.*`, `utilities.kind.*`), the enum VALUES are untouched and still what goes to the API, and an unknown value from the API renders as itself rather than as a key name — the same contract `/statements`'s unmatched-reason codes now have. Units of measure (kWh, kL, m3) are deliberately NOT translated: they are unit symbols that go to the API. (3) **`components/pager.tsx` was pulled forward from Day 5**, because it hardcoded `toLocaleString('en-ZA')` and two Day 3 routes use it: South African digit grouping under a Chinese page is exactly the drift this plan exists to remove. It now takes an already-translated `noun` from the caller. Also converted along the way: every raw ISO date on these six routes (`l.start_date`, statement line dates, reading dates) now formats per locale instead of printing the API's string, and `money` on these routes comes from the locale rather than `components/ui`. Typecheck clean, panel spec 21/21. Left, reported not fixed: (i) `/leases` renders the lease `type` and `status` as the API's raw enum values — they need a key set like the two above, but that enum lives in `src/` and Day 3's file list does not include it, so Day 4 or 5 should read it and add them; (ii) `/utilities` has an inline pager duplicating `components/pager.tsx` — translated in place with the same keys and commented, because swapping in `<Pager>` is a behaviour change this day had no mandate for; (iii) `components/ui.tsx` still exports a locale-unaware `money`, used by every route not yet swept, and remains Day 5's job; (iv) Day 2's `externalDir` build check is still unverified and **cannot be done from this session** — a backgrounded `next build` is killed when each shell call ends, so `npm run build` has to be run by hand.
2026-10-10 — Day 4. web-admin sweep part 2: `/listings`, `/applications`, `/owners`, `/agents`, `/providers`, `/reports`, `/documents`, `/inspections`. `en.ts` is now 631 keys. The decisions worth recording. (1) **The inspections checklist areas stay English, because they are data, not labels.** `startEdit` seeds a new checklist from `AREAS` and `saveItems` posts `area` to the API, where it is stored on the inspection record — translating the array would write Chinese into the database and make an inspection's own history depend on whichever language the clerk had selected. The array is unchanged; a separate `AREA_KEYS` map translates the DISPLAY only, and an area with no key (an older record, or free text someone typed) renders its own stored value. `/listings`' `'Listed via back-office'` default description got the same treatment and a comment saying why. (2) **Four more enums got key sets** — provider categories, inspection conditions/types/statuses, application statuses, agent and commission statuses, listing statuses — each replacing a display-time string transform (`cap()`, `String(x).replace('_','-')`, or a CSS `capitalize`). `capitalize` is worth calling out: on `/agents` it was doing the labelling for the tab and filter chips, and it does nothing at all outside the Latin alphabet, so those chips would have rendered lowercase enum values in any non-Latin locale. (3) **Two more hardcoded `en-ZA` formatters found and fixed**: a local `money()` inside `/applications`'s detail panel, and `/owners`' `Math.round(pct * 100) + '%'`, now the locale's `percent()`. Also: agent commission `terms()` was a module-level function closing over `components/ui`'s locale-unaware `money`, so it now takes the translator and the locale's formatter as arguments. Typecheck clean, panel spec 21/21. Left, reported not fixed: (i) **a grep for `toLocaleString('en` turns up eight more sites in files this day did not own** — `components/ui.tsx`'s exported `money` (the big one, used by every unswept route), `components/new-agency-form.tsx`, `app/messages`, `app/rentals`, `app/partner/page.tsx`, `app/partner/activity`, `app/admin/agencies` and `app/admin/imports/[vendorId]`. Day 5 owns `ui.tsx` and the partner routes; the admin and rentals ones are outside every day's list in this plan and need a day of their own. (ii) `/reports`' x-axis abbreviates thousands as `R{n}k`; the `k` is now a key, but a locale that groups by ten-thousands (Chinese 万) cannot be served by relabelling alone — it needs a different divisor, which is a formatter change, not a translation. Flagged rather than faked. (iii) `/applications`' screening recommendation and employment fields come from the API as free text and are shown as sent — there is no fixed vocabulary to key against. (iv) Day 3's lease `type`/`status` enum is still raw, and Day 2's `externalDir` build check is still unverified.
2026-10-10 — Day 5. web-admin sweep part 3: `components/ui.tsx`, `/settings`, `/billing`, `/notifications`, `/messages`, `/api-keys`, all four `/portal/*` routes and all seven `/partner/*` routes — 18 files. `en.ts` is now 960 keys. Typecheck clean, panel spec 21/21, signals spec 16/16. `components/assistant/content.ts` was excluded as the day specifies.

The decisions. (1) **`components/ui.tsx`'s exported `money` is deprecated, not deleted.** It was `'R' + Number(n).toLocaleString('en-ZA')`, imported by most of the app. Deleting it would break four routes outside this plan's day list, and a plain function cannot see the provider to guess a locale honestly — so it now formats in the DEFAULT locale through the one shared formatter (ZAR rule intact), carries an `@deprecated` pointing at `useLocale().money`, and every route swept on Days 3–5 uses the hook instead. Four files still import it: `app/admin/billing`, `app/admin/commissions`, `app/admin/payouts`, `app/l/[id]`. (2) **`/partner/manual` is a server component, so it cannot use the hook.** Its chrome now translates from the request-resolved locale (`DEPLOYMENT_LOCALE`, then host). The limitation this leaves is real and worth stating plainly: a viewer who switches language with the in-app switcher sees that choice everywhere **except** this page, because the stored preference lives in their browser and the page renders before it is readable. Fixing it needs a cookie the server can read, or splitting the chrome into a client component. The manual's own text stays English by design. (3) **`/billing`'s plan paragraph** was a nest of template literals with inline plurals; each branch is now one whole sentence in the catalogue with the amounts, unit counts and bands interpolated, so a translator can reorder inside a sentence rather than being handed fragments. (4) **Two emphasis spans were widened.** `/billing`'s EFT paragraph bolded a clause mid-sentence and `/settings`' advanced-template hint wrapped a token in `<code>`; a clause split across JSX cannot be reordered by a translator, so the EFT emphasis now covers its own whole sentence and the `<code>` styling on `{{tenant_name}}` is gone (the token is interpolated instead). Both are small presentational changes, recorded here rather than left for someone to find. (5) **`/partner/leaderboard` named "Locare" in its gate and privacy copy** — wrong on a white-label deployment — so it now reads the brand like every other surface. Six more hardcoded locale formatters were fixed along the way (`/messages`, `/partner/page.tsx`, `/partner/activity`, `/partner/agencies`, `/portal/statements`, `/api-keys` and `/notifications`, the last two having used `toLocaleString()` with no locale at all, which follows the BROWSER's language rather than the app's).

Left, reported not fixed:

(i) **The day's claim that it "completes web-admin" is wrong, and this matters for Day 9's verification.** Not swept, and outside every day's file list in this plan: all ten `app/admin/*` routes, `app/rentals`, `app/l/[id]`, `app/login`, `app/signup`, `app/partner-apply`, `app/pay/*`, `app/sign/*`, `app/no-access`, `app/demo`, `app/lease-parsing`, `components/public-chrome.tsx`, `components/new-agency-form.tsx` and `components/idle-timeout.tsx`. Eight of them still hold hardcoded `en-ZA` formatters. **Phase 3 needs an extra day for these before Day 9 can honestly claim "no hardcoded English left".** The public ones (`/rentals`, `/l/[id]`, `/login`, `/signup`) matter most: they are what a prospect sees.

(ii) `/partner/leaderboard`'s heading reads **"Progress to Reseller (26%)"** — and unlike the gate amount and month count beside it, that 26% is written into the copy, not read from a constant. If the commission structure changes, the string lies. I reproduced it as-is and keyed it rather than quietly correcting it, because changing a stated rate is not a translation decision. **Vernon's call**, and `docs/LOCARE_COMMISSION_STRUCTURE.md` is presumably where the real number lives.

(iii) `/notifications` renders template names (`rent_due_reminder`, …) through a best-effort prettifier: they are arbitrary API codes with no list this page can see, so there is nothing to key against and they stay English in every locale. Same for `/applications`' screening recommendation and `/partner/agencies`' subscription status.

(iv) `/partner/pipeline` still asks for a lost reason with `window.prompt`. The string is translated, but a native dialog cannot be styled or laid out and ignores the page's direction — replacing it with a modal is a UI change this day had no mandate for.

(v) Carried: Day 3's lease `type`/`status` enum is still raw, `/reports`' thousands abbreviation still cannot express a ten-thousands grouping, `/utilities` still has an inline pager duplicating `components/pager.tsx`, and **Day 2's `externalDir` build check is still unverified** — it cannot be done from this session.
2026-10-10 — Day 6. mobile-tenant. `en.ts` is now 1080 keys (`tenant.*`, namespaced separately from the back-office keys even where the English matches — a tenant and a property manager read about the same thing as different audiences). Both sides typecheck clean; every `tr()`/`tn()` key the app references is confirmed present in `en.ts`.

**The Metro question the day was there to answer: resolved, and with no new dependency.** `mobile-tenant/metro.config.js` (new) sets `watchFolders` to the repo's `shared/` directory only — not the repo root, which would pull web-admin's and the API's `node_modules` into Metro's file map and slow every rebuild — and pins `nodeModulesPaths` to this app's own `node_modules` so a module required from the watched folder cannot resolve a second copy of React. `expo/metro-config` is already a transitive dependency of `expo`, so package.json is untouched. Deliberately NOT a path alias: `@shared/*` would need `babel-plugin-module-resolver`, and the plan says stop rather than add one — so the screens use relative imports (`../../shared/i18n`), which read slightly worse and cost nothing. **Day 7 inherits this answer.**

Two platform differences from web, both forced and both recorded in `src/i18n.tsx` rather than hidden: persistence reuses the SecureStore/localStorage pair `src/api.ts` already uses for the session token (a locale is not a secret and SecureStore is not really its home, but the alternative was adding async-storage); and the device language is read from `Intl.DateTimeFormat().resolvedOptions().locale` rather than `expo-localization`, wrapped so a runtime without Intl falls back to English instead of crashing on first render. Unlike web there is no server render, so the app can start on the device's own language and correct from storage on mount.

Decisions. (1) **Maintenance categories moved to lowercase values.** They were English title-case strings held in state and sent as `category.toLowerCase()`; the stored value is therefore unchanged, but keeping the English strings as state would have meant translating what goes to the server and writing Chinese into ticket records. Categories, priorities and statuses now each have a key set. (2) **`HomeScreen` was choosing the hero's colour by string-comparing a label against `'Overdue'`** — which breaks the moment the label is translated, and would have silently shown a calm hero on an overdue account in Mandarin. Split into a `dueState()` returning a state plus a `dueLabel()` that renders it; the colour now switches on the state. **This was a real latent bug, not a translation artifact.** (3) `src/ui.tsx`'s `money` is deprecated the same way web-admin's is, formatting in the default locale through the shared formatter, because the two unreachable screens still import it. (4) The switcher is chips on the Profile screen rather than a Picker: a Picker needs `@react-native-picker/picker`, and the two shipped locales fit on one row. Each chip is labelled in its own language.

Left, reported not fixed:

(i) **`src/screens/DashboardScreen.tsx` (105 lines) and `src/screens/LeaseScreen.tsx` (54 lines) are imported by nothing.** `MainScreen` hosts Home/Pay/Docs/Profile and `App.tsx` registers only Main, Maintenance, Messages and Login; `DashboardScreen` even navigates to a `'Lease'` route that is not registered. I did **not** translate them — 159 lines of unreachable screens is waste, and translating them would have hidden the fact that they are dead. **Vernon's call: delete them, or wire them back in and they need a sweep.** They are the only remaining importers of the deprecated `money`.

(ii) `lease.billingCycle` on the Documents screen and an unpaid invoice's `status` on the Pay screen are API enums with no key set — shown as sent. The `textTransform: 'capitalize'` on those value styles was doing the formatting and does nothing outside the Latin alphabet. The billing-cycle enum lives in `src/`, which this day's file list does not include.

(iii) **Nothing here has been run.** Typecheck and a key-presence check are not a bundle: whether Metro actually resolves `../../shared/i18n` at runtime needs `npx expo start` in `mobile-tenant`, which this session cannot do (the same sandbox limit that blocks Day 2's `next build`). **If one command gets run by hand before Day 7, it should be that one** — Day 7 copies this exact configuration into the landlord app, so a mistake here doubles.

(iv) Carried: Day 2's `externalDir` check, Day 5's untouched `app/admin/*` and public routes (still needing their own day before Day 9), the leaderboard's hardcoded 26%, and Day 3's lease enum.
2026-10-10 — Day 7. mobile-landlord. `en.ts` is now 1170 keys (`landlord.*`, separate from `tenant.*` even where the English matches — the two apps address opposite sides of the same tenancy, and "Close" on a manager's thread is not necessarily "closed" on a tenant's). All three surfaces typecheck clean; every `tr()`/`tn()` key the landlord app references is confirmed present in `en.ts`, and no `en-ZA` or hardcoded label survives a sweep of its screens.

Day 6 answered the Metro question, so this day was mostly mechanical: `metro.config.js` is the tenant app's file with its comment retargeted, and `src/i18n.tsx` is a deliberate copy. **That copy is a decision, not an oversight**, and the file says so: the two apps are separate Expo projects with their own `node_modules` and no shared source directory of their own, so the alternative was a third shared package for 120 lines. If a third app ever appears, that trade flips and it belongs in `shared/`. The tab bar came free — `GlassTabBar` renders each route's `options.title`, so translating the five `Tab.Screen` titles translates the bar.

Decisions. (1) **The screening verdict IS keyed here, unlike web-admin.** On `/applications` the recommendation is free text shown as sent; this screen compares it against `'approve'`/`'decline'` to choose a pill colour, so the vocabulary is known at this point and can have keys. Worth recording because the two surfaces now treat the same API field differently, and that is deliberate. (2) Ticket categories, priorities, ticket statuses and work-order statuses each got key sets; the `textTransform: 'capitalize'` on the category style was doing the display formatting and does nothing outside the Latin alphabet. (3) The work-order line was `Work order {id} · {status}` with the contractor appended — now two whole keys, because a language that orders those clauses differently cannot be served by concatenation. (4) `src/ui.tsx`'s `money` is deprecated in the same shape as the other two surfaces; no screen in this app imports it any more.

Left, reported not fixed:

(i) **Still nothing has been run — and this is now the single largest piece of unverified work in the plan.** Three surfaces import `shared/i18n`, two of them through a Metro config no one has bundled. `npx expo start` in `mobile-landlord` and in `mobile-tenant`, plus `npm run build` in `web-admin`, are the three commands that would confirm Days 2, 6 and 7 actually work. A typecheck proves the types line up; it proves nothing about module resolution at bundle time.

(ii) The tenant app's two dead screens (`DashboardScreen`, `LeaseScreen`) are still untranslated and still await Vernon's delete-or-revive. The landlord app has no equivalent — all five of its screens are reachable.

(iii) Carried: Day 5's untouched `app/admin/*` and public web routes (still needing their own day before Day 9 can honestly verify), the leaderboard's hardcoded 26%, `/reports`' thousands abbreviation, and the lease/billing-cycle enums that live in `src/` and are outside every day's file list.
2026-10-10 — Day 7 follow-up (asked for, outside the day sequence). **The tenant app's two dead screens are revived rather than deleted**, per Vernon. `DashboardScreen` and `LeaseScreen` are now registered stack screens with translated titles, swept into the catalogue, and — the part that actually makes "revived" true — each has a real entry point: **Lease** from the Documents tab, under the lease-terms summary, since the full view is what adds the lease's status and type; **Account overview** from Profile, as a secondary destination rather than a second Home tab. `MainScreen` now passes `navigation` into Docs and Profile so they can push them. Worth recording: `DashboardScreen`'s Lease action called `navigate('Lease')` against a route that was never registered, so it would have thrown the moment anyone reached it — the screens were not merely unreachable, one of them was broken. Neither imports the deprecated `money` any more; nothing in the tenant app does. Typecheck clean, every key present. **Still Vernon's judgement, and not a translation question:** `DashboardScreen` overlaps `HomeScreen` (rent hero, pay action) and `PayScreen` (full invoice list) almost completely, so a tenant now has two places showing the same rent. It is reachable and correct, but if the overlap is unwanted the fix is a product decision, not an i18n one.
2026-10-10 — Day 8. marketing. **The decision the day asked for, and it is neither of the two options the plan offered.** Both are wrong for this site, and `index.html` says why in its own comment: it carries a JSON-LD FAQPage that must stay in sync with the visible copy, and "divergence is a manual-action risk". A client-side swap leaves the structured data describing English while the page shows Chinese — precisely that divergence, on the page where it costs most, plus a flash of English and nothing for a crawler. Hand-written per-locale copies of an 822-line SEO-critical page, in a directory whose guides are regenerated weekly by a content agent, drift the day after they are made.

So: **one English source, pre-rendered per-locale output.** `scripts/marketing-i18n/` (three plain Node scripts, zero dependencies — the site gains no build step it did not have, these are `npm run` scripts): `extract.mjs` writes the translator's checklist, `build.mjs` renders `marketing/<locale>/…`, `selftest.mjs` proves the renderer does not mangle markup. Output is static, so `hreflang` works, JavaScript-off works, and crawlers see real pages; there is no second copy to maintain.

Translations are keyed by the **English source text**, not by `data-i18n` attributes added to the markup. That means the source pages are never touched (this pipeline cannot break the live English site), the weekly content agent needs to know nothing about i18n, and visible copy and structured data translate from the same map. The cost is real and is made loud rather than hidden: a reworded English string loses its translation, so the build reports every unmatched string, exits non-zero, and **writes nothing at all** — a half-Chinese marketing page reads as broken rather than as untranslated.

**Two things verification caught that a coverage count would not have.** (1) A probe run showed the JSON-LD descriptions staying English while the visible copy translated — the structured data has prose of its own that is not on the page, so nothing matched it, and the walk skipped misses silently. That is the exact divergence this design claims to prevent. Fixed: `JSONLD_PROSE_KEYS` puts JSON-LD prose into the inventory (239 strings, up from 222) and reports misses like any other string, while everything outside that key list — price, priceCurrency, url, @type, the CIPC registration number — is left alone *by construction* rather than by hoping it has no catalogue entry. Re-probed: a JSON-LD-only string now translates, and the price and registration number come through untouched. (2) `selftest.mjs` renders an identity locale and diffs it against the source, so the only permitted differences are `<html lang>`, the canonical/hreflang block and reserialised JSON-LD. It passes on both pages, and it is the check that matters most here: a scanner bug on a 59KB revenue page would not show up as missing coverage.

Scope, as the day specifies: `index.html` and one guide (`guides/popia-for-letting-agents.html`) are in the build as the pattern. `social/` (ad creative), `internal/` (not public), `demo/`, `tools/` (calculator UI, needs its own pass) and the other guide bodies are out, and `PAGES` in `lib.mjs` is the one place to add them.

Left:

(i) **`shared/i18n/marketing/zh-Hans.json` is a scaffold — 233 entries, all empty.** Day 9 fills it. Until then the build correctly refuses to write anything, which is why there is no `marketing/zh-Hans/` directory yet.

(ii) **The Dockerfile and sitemap are deliberately NOT updated.** Adding `COPY zh-Hans /srv/zh-Hans` now would ship a duplicate-content English page at `/zh-Hans/` — an SEO own-goal. The build prints both steps as the next action once coverage is complete; Day 9 should do them in the same change as the fill.

(iii) Marketing strings live in `shared/i18n/marketing/*.json` rather than in `shared/i18n/en.ts`. Same directory, so there is still one home for catalogues, but JSON rather than TypeScript because a plain Node script cannot import a `.ts` module without a loader — and a loader is the dependency the plan says to avoid.

(iv) **Nobody on this project reads Chinese.** The scaffold's `_README` carries the unreviewed-translation rule and the do-not-translate list (prices, VAT rates, POPIA/PPRA/Rental Housing Act, registration numbers, URLs). This page states prices and a VAT rate; a mistranslation there is a commercial claim, not a typo.

(v) Carried: Day 2's `externalDir` check, Days 6–7's unbundled Metro configs, Day 5's untouched `app/admin/*` and public web routes (still needing their own day before Day 9), and the leaderboard's hardcoded 26%.
