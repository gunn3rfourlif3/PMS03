# Locare assistant — 7-day build plan

Written 2026-09-23. Owner: Vernon. Read with `LOCARE_ASSISTANT_DESIGN.md`.

One scheduled run per morning does **one day** of this plan and stops. Days are
sized to be finishable in a single run without exploring the repo.

## How a run works

1. Read this file. Find the **first day whose box is unticked**. That is today's
   scope, whatever the date is.
2. Read only the files that day lists. Do not grep or search the repo.
3. Do the work. Typecheck `web-admin`. Do not run the stack, install packages,
   or touch anything outside `web-admin/components/assistant/` unless the day
   says so.
4. Tick the box, append one line to the log at the bottom, and stop.
5. **Do not commit, push or deploy.** Vernon runs git himself. End by printing
   the `git add` / `git commit` line for the day's files.

If every box is ticked, do nothing and say the plan is complete.

## Standing constraints

From the design doc, and not to be relitigated by a run:

- Partner routes only (`PARTNER_NAV`). No agency, owner or admin surface.
- No LLM, no API call, no new endpoint, no new table, no `ANTHROPIC_API_KEY`.
- Content is curated per route and links into `docs/manuals/Partner-Manual.md`.
- Never restate a rate, price or threshold — link to the manual section instead.
- Panel hides when `actorFromToken()` returns an actor (impersonation).
- Unbranded wording; colour from `--brand`.

---

## Day 1 — Panel shell

Read: `web-admin/components/shell.tsx`, `web-admin/lib/cn.ts`.

Create `web-admin/components/assistant/panel.tsx` — a slide-over, closed by
default, opened by a help button rendered in the partner header only. Escape and
a backdrop click close it. Hidden entirely during impersonation. Mount it from
`Shell` for `PARTNER_NAV` routes only.

Content is out of scope today: render the route key and a placeholder line.

- [x] Done

## Day 2 — Content lookup + Overview and Pipeline

Read: `web-admin/app/partner/page.tsx`, `web-admin/app/partner/pipeline/page.tsx`,
`docs/manuals/Partner-Manual.md` (Overview and Pipeline sections only).

Create `web-admin/components/assistant/content.ts`: a typed map of route key to
`{ title, purpose, questions: {q, a}[], manualAnchor }`. Fill `/partner` and
`/partner/pipeline` from the manual's question headings verbatim — the manual is
the source of truth, so copy, do not paraphrase.

Unknown route falls back to a generic entry naming the manual. No empty panel.

- [x] Done

## Day 3 — Agencies and Commissions content

Read: `web-admin/app/partner/agencies/page.tsx`,
`web-admin/app/partner/commissions/page.tsx`, the matching manual sections.

Same shape as Day 2. Commissions is the highest-risk section: no rate, no
threshold, no rand figure in the copy — link to the manual.

- [x] Done

## Day 4 — Activity, Banking, Leaderboard content

Read: the three matching manual sections. Pages only if a label is unclear.

Completes all seven routes. Re-read the panel once end to end for tone: every
answer is one or two sentences, and no answer invents a fact the manual lacks.

- [x] Done

## Day 5 — Signals, pure functions

Read: `src/modules/partners/pipeline.ts`, `src/modules/partners/partner.entities.ts`.

Create `web-admin/components/assistant/signals.ts` — pure functions over data the
partner pages already hold. The four from the design doc §6: stale open deal
(>14 days on `stageChangedAt`), at the open-lead cap, banking missing, unread
changelog entries. Each returns `{ id, text, href } | null`.

No fetching today. Pure functions and a Jest spec in `test/` — this is the only
day that writes outside `web-admin/components/assistant/`.

- [x] Done

## Day 6 — Wire signals into the panel

Read: `web-admin/components/assistant/panel.tsx`, `signals.ts`, and whichever
partner page supplies each input.

Signals render above the questions, at most three at once, each one click from
being resolved. A signal with no data renders nothing — never a spinner, never
"no issues found".

**The blocked-upstream guard:** no signal may prompt an action that is gated on
partner approval while approvals are blocked on the outstanding VAT number.
Check the guard before firing, and leave a comment saying why it exists.

- [x] Done

## Day 7 — Accessibility, mobile, verification

Read: `web-admin/components/assistant/*`, `web-admin/app/globals.css` (tokens only).

Keyboard path end to end: focus moves into the panel on open, returns to the
button on close, Escape closes, focus is trapped while open. Respects
`prefers-reduced-motion`. Full-width sheet under `lg`. Contrast checked against
the dark sidebar and the light page.

Then verify the week: typecheck, run the Day 5 spec, and re-read every answer
against the manual. Report anything that drifted rather than fixing it silently.

- [x] Done

---

## Log

One line per run: date, day number, what landed, anything left.

2026-09-24 — Day 1. Panel shell `components/assistant/panel.tsx` (slide-over, Escape + backdrop close, hidden during impersonation, route key placeholder) mounted from Shell on PARTNER_NAV routes. Typecheck clean. Nothing left.
2026-09-25 — Day 2. `components/assistant/content.ts` (typed route→entry map, Overview + Pipeline from the manual's question headings verbatim, generic fallback entry) and the panel now renders title, purpose, Q&A and a manual-section pointer. Typecheck clean. Left: the manual pointer is plain text, not a link — nothing in web-admin serves `docs/manuals/Partner-Manual.md`, so Vernon needs to say where it lives before Day 6 signals can carry an href.
2026-09-26 — Day 3. `content.ts` gains `/partner/agencies` and `/partner/commissions`, questions copied verbatim from the manual's Agencies and Commissions sections. Commissions copy carries no rate, threshold, term or rand figure — the 90-day window, the statement/payout dates, the minimum balance, the Introducer term and the rate ladder all point at the manual instead. Typecheck clean. Left: the manual pointer is still plain text (Day 2's open question for Vernon).
2026-09-27 — Day 4. `content.ts` gains `/partner/activity`, `/partner/banking` and `/partner/leaderboard`, questions copied verbatim from the manual's Activity, Banking and Leaderboard sections — all seven partner routes now have curated content. Panel re-read end to end: no answer states a rate, price, window or figure, and none asserts anything the manual does not. Typecheck clean. Left: (a) the manual pointer is still plain text, not a link — Vernon still needs to say where `docs/manuals/Partner-Manual.md` is served before Day 6 signals can carry an href; (b) tone drift for Day 7 to judge, not fixed here — several Agencies and Commissions answers run to three or four sentences against the one-or-two-sentence rule, and two of them (the “prospect asked whether I can see their tenants” and “why not pay on billing” answers) are coaching script rather than page help.
2026-09-28 — Day 5. `components/assistant/signals.ts`: four pure signal functions (stale open deal past 14 days on `stageChangedAt`, at the open-lead cap, banking incomplete, unread changelog) each returning `{ id, text, href } | null`, plus `test/assistant-signals.spec.ts` (19 cases). Deliberately no import from `src/` — the entities pull in TypeORM, so the funnel stages and the banking field list are structural copies with a comment saying they move together. Cap text states no number; the masked `accountNumberLast4` counts as banking present. Typecheck clean, spec green. Left: (a) the manual pointer is still plain text (Days 2–4 open question); (b) the changelog signal has nowhere to link — the changelog is served at `/admin/changelog`, not a partner route, so `unreadChangelogSignal` takes an explicit `href` and returns null without one, and Day 6 must not render it until Vernon says where partners read updates; (c) Day 4’s tone drift still stands for Day 7.
2026-09-30 — Day 6. `components/assistant/use-signals.ts`: signals fetched lazily on first panel open from the partner endpoints the pages already call (`/partner/deals`, `/partner/banking`, `/partner/me`) with the user's own JWT — no new endpoint, no page edits — then built, guarded and capped at three by `buildSignals`. Panel renders them above the questions as one-click links that close the panel; empty list renders nothing, and any fetch failure falls back to curated content with no error and no spinner. Blocked-upstream guard implemented as `APPROVAL_GATED_SIGNAL_IDS` + `isPastApprovalGate`: `banking-missing` fires only for a partner whose status is exactly `active`, since payouts cannot run while approval is held on the VAT number, and an unknown status is not evidence of approval. Typecheck clean. Left: (a) the manual pointer is still plain text (Days 2–4 open question); (b) the changelog signal is wired but inert — `PARTNER_CHANGELOG_HREF` is empty and the unread count is passed as 0, because no partner route serves the changelog and no partner endpoint reports unread; (c) the open-lead cap signal reads the cap from `/partner/me` (`openLeadCap`/`maxOpenLeads`/`leadCap`) and stays silent if none is present — Vernon to confirm whether `/partner/me` exposes the cap at all, or the signal can never fire; (d) Day 4's tone drift still stands for Day 7.
2026-10-01 — Day 7. Accessibility and verification. `panel.tsx`: focus moves to the close button on open and back to the help button that opened it on close, Tab is trapped inside the sheet (aria-modal), Escape still closes, the sheet is full-width under `lg` (`max-w-none lg:max-w-[420px]`) and both sheet and backdrop carry `motion-reduce:animate-none` so `prefers-reduced-motion` is honoured without touching `globals.css`. Contrast checked against the tokens: white on `--brand` and `--brand` on white 6.2:1, `--muted` on white 4.83:1, `--ink` on white 17.8:1 — all AA; the triggers sit in the content column, never over the dark sidebar. Week verified: typecheck clean, Day 5 spec green (19/19), and all 25 curated questions confirmed present verbatim in `docs/manuals/Partner-Manual.md`, with no rate, threshold, window or rand figure anywhere in the answers. Left, reported not fixed: (a) the manual pointer is still plain text — Vernon to say where `Partner-Manual.md` is served; (b) the changelog signal is wired but inert (`PARTNER_CHANGELOG_HREF` empty, unread count 0); (c) Vernon to confirm `/partner/me` exposes an open-lead cap, or that signal can never fire; (d) tone drift stands — four answers run to three or four sentences against the one-or-two rule (the open-lead cap, “how does an agency become mine”, the commission statuses, and “can I earn on my own agency”), and the “prospect asked whether I can see their tenants” and “why not pay on billing” answers remain coaching script rather than page help; all are verbatim manual copy, so trimming them means departing from the manual — Vernon's call.
2026-10-01 — Day 7 follow-up (asked for, outside the plan). Component tests added for `web-admin`: `components/assistant/panel.spec.tsx` (20 cases — route keying, impersonation guard, open/close, focus in and out, Tab trap, signal rules, curated content, no-figures check, mobile width, reduced motion) with `jest.config.js`, `jest.setup.ts`, `jest.style-stub.js` and a `test` script. Transform is ts-jest, not `next/jest`: the SWC native binding segfaults (“Bus error”) in this environment and these specs need no Next compiler features. The specs found a real defect in Day 7's trap, now fixed: focus stops were filtered on `el.offsetParent !== null`, which is null wherever layout has not been computed — the list came back empty and Tab walked the page behind the aria-modal dialog. Filtered on `hidden`/`aria-hidden` instead. Typecheck clean, panel spec 20/20, Day 5 spec still 19/19.
2026-10-02 — Demo partner + an answer to open item (c). `scripts/seed-demo-partner.ts` (`npm run seed:partner`): one active partner, Demo Partner Co / partner@demo.test, with six deals (one 31 days stale in `proposal`), four activities and `banking` left empty, so the stale-deal and banking signals both fire in a real browser. Login is passwordless OTP, so the seed sets no password. While reading the schema for it: **the open-lead cap signal can never fire as written**. `/partner/me` returns the `Partner` entity, which has no cap column at all — the cap lives server-side only, in `openLeadCap()` off `PARTNER_OPEN_LEAD_CAP` with a default of 20 (`src/modules/partners/pipeline.ts`). `useAssistantSignals` looks for `openLeadCap`/`maxOpenLeads`/`leadCap` on that payload and will never find one. Either `/partner/me` (or `/partner/overview`) has to report the cap and the open count, or the signal should come out. Vernon's call — not changed here.
2026-10-02 — Follow-up (asked for, outside the plan). Open item (c) closed: `/partner/me` now reports `openLeadCap` (from `openLeadCap()`) and `openDeals` (counted over OPEN_STAGES), so the open-lead cap signal can fire; `use-signals.ts` prefers the server's count over its own "not won and not lost" filter. No new endpoint — the payload of the one the pipeline page already calls. Also hardened the lease signing-link resend added earlier today: `email()` now returns whether delivery succeeded, `sendSignLinkEmail` takes `throwOnFailure`, and `resendSigningLink` turns an unexpected fault into a 500 instead of answering `{ ok: true }` — the old behaviour told a tenant their link was sent when the migration had not run. `test/lease-agreement-resend.spec.ts` (10 cases) covers the no-enumeration contract, existing-ref reuse, mailing the address on the user record rather than the request, and both loud-failure paths; writing it found the delivery-failure gap. Typecheck clean both sides, spec green. Left: (a) the manual pointer is still plain text and (b) the changelog signal is still inert — both now need a new partner route, which the plan's standing constraints forbid, so they need Vernon to relax that constraint or decide otherwise; (d) Day 4's tone drift still stands.
