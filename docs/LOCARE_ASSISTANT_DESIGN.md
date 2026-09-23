# Locare — in-app assistant

Written 2026-09-23. Owner: Vernon. Status: design, not built.

A helper panel inside the back-office app that answers "what is this screen for,
and what should I do next" — grounded in the manuals, never inventing anything.

**First audience is partners**, not agency staff. Partner screens carry no
tenant or owner personal information, so the whole POPIA and RLS question can be
deferred while the interaction pattern is learned on data that cannot hurt
anyone. Agency staff come second, and only once the partner version has been
used enough to know whether anybody opens it.

**Acceptance:** a partner who has never been trained can open any partner screen,
understand what it is for without asking Vernon, and see the one thing on that
screen that is waiting for them. No model is involved in either.

---

## 1. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Surface | **Back-office app only** (`web-admin`). Not the owner portal, not the tenant or landlord apps. |
| 2 | First audience | **Partners** (`PARTNER_NAV` routes). Agency staff later, platform admin never. |
| 3 | Capability | **Level 1 + next best action.** Explains the product; reads only the partner's own pipeline for prompts. |
| 4 | Brains | **None, for now.** Curated per-route content plus deterministic signals. No LLM in phase 0. |
| 5 | Knowledge source | `docs/manuals/` — one file per audience, same as today. A **partner manual must be written first**; it does not exist. |
| 6 | Writes | **Never.** See §3. |

---

## 2. Why this is not a chatbot

`LOCARE_CHATBOT_DESIGN.md` covers the marketing bot on `locare.co.za` and
explicitly excludes existing users: "that's the in-app help". This is that. The
two stay separate — different audience, different knowledge base, and opposite
jobs. The marketing bot's job is to persuade; this one's job is to be correct.

The instinct is to build a chat box. Chat is the wrong shape for most of the
value here. There are 53 pages in the back office, and for nearly all of them
the useful help is a fixed answer to a fixed question — what this screen is for,
the three things people get wrong, where the matching manual section is. Written
once per route, that answer is right every time, costs nothing, renders
instantly, and cannot hallucinate. A model would make the same answer slower,
more expensive and occasionally wrong.

So phase 0 has no free-text box at all. If partners keep asking things the panel
does not cover, their questions are the specification for phase 1 — and the list
of what they actually asked is worth more than any guess made now.

---

## 3. The three levels, and the wall

1. **Explains the product.** No agency data touched. — *building this*
2. **Reads the signed-in user's own data.** Pipeline counts, commission status.
   — *building the deterministic half only; see §6*
3. **Does things.** Creates, edits, posts. — **never**

Level 3 is a hard wall, not a later phase. The ledger is double-entry and
immutable and it is the product's actual differentiator; an assistant that can
post to it is an unbounded liability against the one thing that cannot be
corrected by editing. The same logic covers deals, commissions and payouts: a
wrongly created commission is an argument with someone about money.

Anything action-shaped is a **deep link with the form prefilled**, which the
person submits themselves. The assistant gets you to the right screen with the
right fields. It never presses the button. This is not a limitation to be
relaxed once the thing is trusted — it is the design.

---

## 4. Architecture

```
web-admin/components/assistant/
├── panel.tsx           slide-over, opened from a header button
├── content/<route>.ts  curated per-route help, keyed on pathname
└── signals.ts          next-best-action, derived from existing API responses

No new API endpoint. No new table. No model provider. No key.
```

Phase 0 ships entirely in the web app. That matters: `ANTHROPIC_API_KEY` is
unset, and the lease parser that would prove the Anthropic provider has never
been run against it, so anything depending on a model is depending on something
untested in production. This depends on nothing.

Route matching uses `usePathname()` against the same keys `Shell` already uses to
pick a nav tree, so a new partner route without help content degrades to the
section index rather than to an empty panel.

---

## 5. Knowledge base

`docs/manuals/` is the source of truth. Today it holds Staff, Tenant and
Landlord manuals — **there is no partner manual, so writing one is the first
task, ahead of any UI.** The material exists but is scattered across
`LOCARE_PARTNER_CURRICULUM.md`, `LOCARE_COMMISSION_STRUCTURE.md` and
`changelog-entries.ts`; it has never been assembled into something a new partner
reads start to finish.

The panel does not parse the manual at runtime. Each route's help is a short
curated entry that **links into** the manual section, so the manual stays the
long form and the panel stays the glance. One rule, the same one the marketing
bot has: if it is not in the manual, the panel does not say it.

Partner-facing figures — rates, thresholds, the open-lead cap — are read from the
code that enforces them (`pipeline.ts`, `commission-calc.ts`), never retyped into
help content. The R925 Starter incident is exactly what retyping produces.

---

## 6. Next best action

Deterministic, derived from data the partner screens already fetch. No new
queries, no inference, no model:

| Signal | Source | Prompt |
|---|---|---|
| Deal untouched > 14 days | `stageChangedAt`, open stages | "4 deals have not moved in two weeks" |
| At the open-lead cap | `isAtOpenLeadCap`, cap 20 | "You cannot add leads until some close" |
| Banking details missing | partner banking | "Payouts cannot run without this" |
| Unread changelog entries | changelog send state | "2 updates you have not read" |

Each prompt states a number the screen can already prove, and links to the exact
place it is resolved. A prompt that cannot be acted on in one click should not
exist.

**Nothing here may nag about something that is blocked upstream.** Partner
approval is currently gated on the outstanding VAT number, so a prompt telling a
partner to chase an approval nobody can grant teaches them to ignore the panel.
Signals must check the blocker before they fire.

**This is not the attention engine.** `LOCARE_ARREARS_CASES_DESIGN.md` defines
that for agency staff — the arrears-driven screen that tells a property manager
what needs doing today. It is a bigger, separate thing with its own data work.
When the assistant eventually reaches agency staff, it **surfaces** the attention
engine rather than computing its own competing answer. Two systems telling a
property manager different "most important things" is worse than neither.

---

## 7. Guardrails that survive phase 1

Written now, because they are hard to retrofit after a model is added.

**Data is read as the signed-in user, always.** If the assistant ever reads
agency data, it calls the existing API with the user's JWT, inside the normal
request-scoped transaction that sets `app.current_vendor_id`. It never queries as
the owner role and never filters in application code. Done this way, prompt
injection cannot reach another agency's data because Postgres refuses — the
isolation is enforced by the same thing that enforces it everywhere else. Done
the other way, the assistant becomes the one component that bypasses the
platform's central non-negotiable.

**The model never computes or restates a number.** Every figure rendered in the
panel comes from an API response and is templated, not generated. A model may
explain what a number means and point at where it came from; it may not say it.
An assistant that misstates an amount once does not lose the user's trust in the
assistant, it loses their trust in the ledger — and the ledger is what is being
sold.

**Off during impersonation.** Support acting inside an agency under an `act`
claim is a different act from staff working in their own agency, and assistant
use there belongs in the audit trail rather than in a convenience panel. The
panel hides when `actorFromToken()` returns an actor.

**White-label.** The panel is unbranded in wording and takes its colour from
`--brand`. Nothing in it names Locare. Partners know what Locare is, but the same
component must be safe the day it appears on an owner-facing screen, and a bot
that introduces itself by name is how the white-label promise breaks.

---

## 8. Deferred: level 2 for agency staff

Not in scope, recorded so the decision is not accidentally made later by someone
adding a feature.

The blocker is not engineering, it is **POPIA**. Level 2 for agency staff means
tenant and owner personal information leaving South Africa to a US model
provider. That data is encrypted at rest precisely because it matters, and the
agency agreements would need to permit sub-processing and cross-border transfer
under s72. Three routes: never send personal information at all (send shapes and
identifiers, render values client-side), redact at the boundary, or paper it
properly. Pick one before building, not after.

Cost is the smaller second question: an always-on model helper is a per-seat cost
sitting on a free Starter tier with no paying customers yet.

---

## 9. Build sequence

1. Write `docs/manuals/Partner-Manual.md`. Nothing else starts first.
2. Panel shell, opened from the partner header, closed by default.
3. Per-route help for the seven partner routes.
4. The four signals in §6.
5. Watch what partners ask that the panel does not answer. That list, not a
   guess, specifies phase 1.

Phases 2 and beyond (agency staff, free text, a model) get their own doc once
there is evidence anyone opens this one.

---

## 10. Open questions

- **Panel or inline?** A slide-over that nobody opens is worse than one good
  paragraph on the empty state of each screen. Worth building the first two
  routes both ways and deciding by use.
- **Does a partner manual want to be public?** Partner recruitment is a sales
  problem; a good manual is a recruiting asset, and publishing it removes a step
  from onboarding. It also tells competitors exactly how the commission works.
- **Who keeps the help current?** The changelog convention works because the
  entry is written in the same commit as the change. Per-route help needs the
  same discipline or it rots — and stale help is worse than none, because it is
  believed.
