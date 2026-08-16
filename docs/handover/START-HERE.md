# Starting a new Claude account on this project

Claude reads `CLAUDE.md` automatically once it has access to this folder, so most
context arrives on its own. This is the bit that doesn't: telling it where the
history lives and what you want next.

## 1. Grant folder access

Sign in, open Cowork, and give it `C:\xampp\htdocs\development\PMS0.3`.

## 2. Copy the scheduled tasks

From the old profile to the new one:

```
C:\Users\verno\Claude\Scheduled\locare-monday-review\
C:\Users\verno\Claude\Scheduled\locare-partner-queue-sweep\
C:\Users\verno\Claude\Scheduled\locare-weekly-guide\
```

Each is a self-contained `SKILL.md` with no dependency on the old conversation.

## 3. Paste this as the first message

> I'm continuing work on Locare, a multi-tenant property-management platform for
> South African rental agencies. It's live in production on a Contabo VPS with
> one agency onboarded and no paying customers yet.
>
> Read `CLAUDE.md` in the repo root first — it has the architecture, the
> non-negotiables (Postgres RLS tenant isolation, immutable double-entry ledger,
> encrypted PII, passwordless auth, host-based branding), the deploy commands and
> the gotchas already paid for.
>
> Full history is in `docs/handover/`: `TASKS.md` lists all 223 tasks with the
> four still open, and `transcript.md` is the complete conversation from the
> previous account (3 MB — grep it, don't read it whole).
>
> Working style: be concise and direct. I run my own git and docker commands, so
> write them out rather than assuming they've been run. Push back if my reasoning
> is weak, and flag real risks — POPIA, PII handling, credentials, unverifiable
> marketing claims — rather than quietly complying.
>
> Before we start, read `CLAUDE.md` and the "Still open" section of
> `docs/handover/TASKS.md` and tell me what you think the highest-priority item
> is and why.

That last line is deliberate: it forces a read of the context files before any
work happens, and the answer tells you immediately whether it actually absorbed
them.

## 4. Verify it landed

Good signs in the reply: it names the four open items, knows WhatsApp is off and
falling back to email, and mentions the legal-entity gap blocking a paying
customer under POPIA. If it asks what the project does, it hasn't read
`CLAUDE.md` — point at the file directly.

## What won't come across

The reasoning behind decisions is in `transcript.md` but not in working memory.
When something looks odd, grep before changing it:

```bash
grep -n -i "brand resolution" docs/handover/transcript.md
grep -n -i "caddy reload" docs/handover/transcript.md
grep -n "## 2026-08-12" docs/handover/transcript.md
```

Several things in this codebase look wrong until you know why they're there —
`force-dynamic` on the root layout, `header_down` in the Caddyfile, the
`--env-file` discipline on every compose command. All three cost real debugging
time. The transcript explains each.
