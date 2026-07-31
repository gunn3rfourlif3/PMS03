# Locare Marketing Chatbot — Design

Status: **Draft for review.** Owner: Arthur. Last updated: 2026-07-31.

An FAQ chatbot on the Locare marketing site (`locare.co.za`) that answers
prospective agencies' questions, stays strictly on-topic, and funnels
interested visitors toward a demo / signup — capturing a lead along the way.

---

## 1. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Lead funnel aggressiveness | **Moderately aggressive** (see §5) — answer first, then proactively offer a demo and ask for an email; never gate answers behind it. |
| 2 | Build sequence | **Design doc first** → scripted MVP → Claude endpoint. |
| 3 | Brains | **Hybrid** — scripted chips (instant, free) + Claude free-text fallback. **Confirmed.** |
| 4 | Model (for the LLM half) | Claude **Haiku** — cheap, fast, sufficient for grounded FAQ. |
| 5 | Knowledge source | One curated `chatbot-knowledge.md` — single source of truth, also feeds the page's FAQ section. |

---

## 2. Goals & non-goals

**Goals:** answer common pre-sales questions instantly; reduce "book a demo
just to ask one thing"; convert curiosity into qualified leads; feel native to
the Locare brand.

**Non-goals:** it is *not* support for existing agencies (that's the in-app
help), not a general assistant, and never a place to discuss a specific
tenant's data. It only talks about Locare-the-product.

---

## 3. Architecture

```
Static marketing page (marketing/index.html)
└── Chat widget (vanilla JS, no framework)
    ├── Quick-reply FAQ chips  ── answered locally (scripted, instant, free)
    └── Free-text box ── POST https://api.locare.co.za/api/faq-chat
                          └── NestJS FaqChatController
                              ├── rate-limit + session cap + token cap
                              ├── system prompt + curated knowledge base
                              ├── LLM provider (reuse existing Anthropic provider) → Claude Haiku
                              └── returns { answer, suggestedCtas[], captureEmail? }
    └── Lead capture card ── POST /api/leads  (type: "chatbot")
```

- The widget is a self-contained script added to `marketing/index.html`; no
  build step, matches the site's General Sans / `#2D6A8F` styling.
- The endpoint lives on the existing API container (reuse the LLM provider from
  the lease-parser work). Needs `api.locare.co.za` reachable + CORS origin
  `https://locare.co.za`, `https://www.locare.co.za`.

---

## 4. Knowledge base

`docs/chatbot-knowledge.md` (or a DB row later) — the ONLY facts the bot may
state. Structured as Q→A plus a short "about Locare" preamble. Covers, at least:

- What Locare is; who it's for; white-label / own-domain story.
- Pricing (Starter free ≤10 units; Growth R250/unit/mo; Enterprise custom) — kept
  in sync with the pricing section; the bot must never invent numbers.
- What's included (leasing, rent collection, trust accounting, owner payouts,
  tenant/landlord apps, rentals site, e-sign, reports).
- Onboarding time, custom domains, data migration, POPIA/PPRA posture, ZA
  payment support, mobile apps (shared vs branded add-on).
- How to start (signup / demo).

Rule: if the answer isn't in the knowledge base, the bot does **not** guess — it
says so and offers a demo (see guardrails).

---

## 5. Conversation design — "moderately aggressive" funnel

Behaviour, precisely:

1. **Answer first, always.** Never withhold an answer to extract an email.
2. **CTA after every answer.** Each reply ends with a relevant action chip:
   "See pricing", "Book a demo", or "Start your agency".
3. **Proactive capture on intent.** When the visitor shows buying intent —
   asks about pricing, migration, onboarding, "how do I start", or after ~2
   exchanges — the bot offers, inline, a compact card: *"Want me to have someone
   walk you through it? Drop your name + email and we'll reach out."* One tap
   away, but proactively surfaced (this is the "moderate" dial — prompted, not
   gated, not nagged every message).
4. **Opt-in, not forced.** The visitor can dismiss and keep chatting. The bot
   asks at most twice per session.
5. **Human handoff.** A persistent "Talk to a human" option → the existing demo
   lead form.
6. **Submit → `/api/leads`** with `type:"chatbot"` and the transcript summary,
   so it lands in the same lead pipeline as the site forms.

---

## 6. Guardrails

- **Grounded only.** System prompt: answer solely from the provided knowledge
  base; if unknown/ambiguous, say "I'm not certain on that — the team can help"
  and surface the demo card. Never invent pricing, features, or timelines.
- **On-topic only.** Politely decline non-Locare questions and redirect.
- **No sensitive data.** Don't request or store ID numbers, banking, tenant
  details. One-line POPIA notice on first open: "Chats may be processed to
  answer you — please don't share sensitive personal info."
- **Safe fallback.** If the API is down or rate-limited, the widget degrades to
  the scripted chips + demo form (still useful, never a dead end).

---

## 7. Abuse & cost controls (public endpoint)

- Claude **Haiku**; `max_tokens` capped (short answers).
- Per-IP rate limit (e.g. 20 messages / 10 min) and a per-session message cap
  (e.g. 15) enforced server-side.
- Knowledge base sent as a cached system prompt; keep it lean.
- Optional: a lightweight bot check (honeypot field / Turnstile) if abuse shows.
- Log usage for a monthly cost view; alert on spikes.

---

## 8. UX / visual

- Floating bubble, bottom-right, Locare blue `#2D6A8F`, General Sans.
- Opens a ~360px panel: greeting + 4–6 suggested chips + input.
- Assistant messages left, visitor right; typing indicator; optional streaming.
- Fully keyboard-accessible; respects reduced-motion; mobile full-width sheet.
- Never `position:fixed` conflicts with the page; self-contained z-index layer.

---

## 9. Open items

- Brains confirmed: **hybrid** (Decision #3).
- Remaining before Phase 2: an Anthropic API key on the API container, and the
  final curated content for `chatbot-knowledge.md` (drafted from the marketing
  copy, then reviewed for accuracy — especially pricing).

---

## 10. Phased roadmap

**Phase 1 — Scripted MVP (no API dependency).** Widget + chips + curated Q&A +
demo-form handoff + moderate-funnel CTAs. Ships with the marketing site.

**Phase 2 — Claude free-text.** `FaqChatController` on the API, knowledge base,
guardrails, rate limits; wire the widget's free-text box to it. Requires
`api.locare.co.za` + CORS + an Anthropic key.

**Phase 3 — Lead + analytics.** Transcript-summary leads into `/api/leads`,
basic dashboards (questions asked, deflection rate, leads captured), and iterate
the knowledge base from real questions.
