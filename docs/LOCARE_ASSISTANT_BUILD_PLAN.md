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

- [ ] Done

## Day 4 — Activity, Banking, Leaderboard content

Read: the three matching manual sections. Pages only if a label is unclear.

Completes all seven routes. Re-read the panel once end to end for tone: every
answer is one or two sentences, and no answer invents a fact the manual lacks.

- [ ] Done

## Day 5 — Signals, pure functions

Read: `src/modules/partners/pipeline.ts`, `src/modules/partners/partner.entities.ts`.

Create `web-admin/components/assistant/signals.ts` — pure functions over data the
partner pages already hold. The four from the design doc §6: stale open deal
(>14 days on `stageChangedAt`), at the open-lead cap, banking missing, unread
changelog entries. Each returns `{ id, text, href } | null`.

No fetching today. Pure functions and a Jest spec in `test/` — this is the only
day that writes outside `web-admin/components/assistant/`.

- [ ] Done

## Day 6 — Wire signals into the panel

Read: `web-admin/components/assistant/panel.tsx`, `signals.ts`, and whichever
partner page supplies each input.

Signals render above the questions, at most three at once, each one click from
being resolved. A signal with no data renders nothing — never a spinner, never
"no issues found".

**The blocked-upstream guard:** no signal may prompt an action that is gated on
partner approval while approvals are blocked on the outstanding VAT number.
Check the guard before firing, and leave a comment saying why it exists.

- [ ] Done

## Day 7 — Accessibility, mobile, verification

Read: `web-admin/components/assistant/*`, `web-admin/app/globals.css` (tokens only).

Keyboard path end to end: focus moves into the panel on open, returns to the
button on close, Escape closes, focus is trapped while open. Respects
`prefers-reduced-motion`. Full-width sheet under `lg`. Contrast checked against
the dark sidebar and the light page.

Then verify the week: typecheck, run the Day 5 spec, and re-read every answer
against the manual. Report anything that drifted rather than fixing it silently.

- [ ] Done

---

## Log

One line per run: date, day number, what landed, anything left.

2026-09-24 — Day 1. Panel shell `components/assistant/panel.tsx` (slide-over, Escape + backdrop close, hidden during impersonation, route key placeholder) mounted from Shell on PARTNER_NAV routes. Typecheck clean. Nothing left.
2026-09-25 — Day 2. `components/assistant/content.ts` (typed route→entry map, Overview + Pipeline from the manual's question headings verbatim, generic fallback entry) and the panel now renders title, purpose, Q&A and a manual-section pointer. Typecheck clean. Left: the manual pointer is plain text, not a link — nothing in web-admin serves `docs/manuals/Partner-Manual.md`, so Vernon needs to say where it lives before Day 6 signals can carry an href.
