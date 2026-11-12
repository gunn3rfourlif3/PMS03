# Gotchas

Bugs that have already been paid for once, written down so they are not paid
for twice.

**How this file relates to `CLAUDE.md`.** The *Gotchas already paid for*
section in `CLAUDE.md` is the curated, load-bearing set — it is read at the
start of every session, so it stays short. This file is the accumulating log:
the daily debug run appends here, and anything that proves load-bearing gets
promoted by hand into `CLAUDE.md`. Nothing is deleted from either.

**Entry format.** Date, a title that names the symptom, then three lines:
what you SEE, what is actually WRONG, and the RULE that prevents a repeat. The
rule is the part that earns the entry — an entry with no transferable rule is a
bug report, not a gotcha.

---

## 2026-11-12 — Hardcoded `bg-white` is invisible in the dark theme

**Symptom.** A control is "missing" on the dark back office. It is rendering,
and it is the right size and position — it simply cannot be seen.

**Cause.** `bg-white` with `text-ink`. In the dark theme `--ink` is `#EEF1F6`,
so the result is near-white text on a white background. Hit the assistant
trigger button and the panel sheet, both written for the light-only partner
surface.

**Rule.** No component names a colour. Backgrounds come from `--card`, `--bg`
or a `color-mix` of `--ink`; text from `--ink` or `--muted`. A literal `white`,
`black` or hex in a component is a bug in waiting, because the theme it was
written under is not the only theme it will run under.

---

## 2026-11-12 — Inline `:root` styles outrank the dark theme block

**Symptom.** `DEPLOYMENT_THEME=dark` is set, the attribute is on the element,
and the page renders light anyway.

**Cause.** `applyTheme()` writes branding colours as inline styles on `:root`.
Inline styles beat `:root[data-theme="dark"]` on specificity, so the agency's
light surfaces overwrote the dark ones on every load.

**Rule.** Branding sets `--brand`, `--onbrand` and `--accent` in both themes,
and surface tokens in light mode ONLY. Anything that writes a token inline must
ask what theme it is in first.

---

## 2026-11-11 — Four queries counted a payment by its first invoice

**Symptom.** Collection rate pinned at exactly 100.0%. Owner statements paying
the wrong amount.

**Cause.** `JOIN invoices i ON i.id = (p.allocation->0->>'invoiceId')::uuid`
with `SUM(p.amount)`. Two faults: `->0` reads only the first invoice a payment
touched, and `SUM(p.amount)` adds the payment's whole value there. A payment
settling two months counted twice over, in the wrong month. In
`grossCollected` the first allocation line can belong to a different owner's
property, so it paid the wrong landlord.

**Rule.** A payment's relationship to invoices is the allocation ARRAY. Expand
it with `jsonb_array_elements` and sum the line amounts; never index into it,
never sum the parent's total. One shared SQL fragment, in
`src/common/database/invoice-outstanding.ts`, and no second copy.

---

## 2026-11-11 — A clamped display hid the bug that produced it

**Symptom.** A collection ring reading a tidy `100.0%` that nobody could
explain.

**Cause.** The ring clamped the FIGURE as well as the arc, so a computed 103%
rendered as 100.0%. The display was concealing the arithmetic fault above it.

**Rule.** Clamp what you draw, never what you report. A circle cannot show more
than full, so the arc clamps; the number must be free to be wrong visibly,
because a number that cannot look wrong cannot be noticed.

---

## 2026-11-11 — `outputFileTracingRoot` is read from `experimental` on Next 14

**Symptom.** A pinned tracing root has no effect, and `.next/standalone` keeps
the layout Next inferred.

**Cause.** The key is top-level in Next 15 and under `experimental` in Next 14.
Set at the top level on 14 it is silently ignored — no warning, no error.

**Rule.** When an upgrade moves a config key, MOVE it. Leaving a copy at both
levels means the behaviour changes on the day of the upgrade, which is the
worst possible day to discover it.

---

## 2026-11-11 — The web image could not see `shared/`

**Symptom.** `Module not found: Can't resolve '@shared/i18n'` in the Docker
build, while `npm run build` succeeds locally.

**Cause.** The compose build context was `../web-admin`, and `shared/` is a
sibling of that directory, so it was never in the context. It had been masked
for weeks by a `COPY . .` cache hit — `npm run build` had not actually re-run
since the imports landed.

**Rule.** A build context must contain everything the build reaches. When an
app imports across a directory boundary, the context is the repo root. And a
green build that was cached is not a green build.

---

## 2026-11-11 — Files read at request time are not traced into the bundle

**Symptom.** `/partner/manual` works locally and fails in production.

**Cause.** The route opens `docs/manuals/…` from disk at render time. The
standalone bundle traces IMPORTS; a file opened by name at runtime is invisible
to it, so the manuals were never in the image. It worked locally only because
the repo happened to be there.

**Rule.** Anything read by path at runtime must be copied into the image
explicitly, and the Dockerfile should fail the build when it is missing rather
than shipping a route that 404s.

---

## 2026-11-11 — Guard the build, not the container

**Symptom.** A container that builds cleanly and then crash-loops after
`up -d --force-recreate` has already replaced the working one.

**Cause.** The runtime stage expected `server.js` at a path the build no longer
produced. Nothing checked before the image shipped.

**Rule.** When a runtime stage depends on a path the build stage produced,
assert it in the build:
`RUN test -f <path> || (echo "<what changed>" && find <dir> && exit 1)`.
A failed build keeps production serving. A failed container does not.

---

## 2026-11-10 — DB-backed tests connect as the owner, which RLS exempts

**Symptom.** A test asserting a vendor-wide total passes on an empty database
and fails on a seeded one.

**Cause.** Postgres exempts a table's owner from its own RLS policies, so
`set_config('app.current_vendor_id', …)` scopes nothing in a suite connected as
the owner. The query sees every vendor's rows.

**Rule.** Per-lease and per-row assertions are safe. Any assertion on a
vendor-wide aggregate must be written as a DELTA — measure, insert the fixture
inside the transaction, measure again — so it is indifferent to whatever else
is in the database.

---

## 2026-11-10 — `jsonb_array_elements` raises, and the WHERE guard is a coin flip

**Symptom.** Nothing, usually. Then an error on one row, on one Postgres
version, in production.

**Cause.** `jsonb_array_elements` raises on a JSON object rather than returning
no rows. A `jsonb_typeof(...) = 'array'` guard in the WHERE clause appears to
work because the planner pushes the filter down to the table scan — but
evaluation order between WHERE and a FROM-clause set-returning function is a
planner decision, not a guarantee.

**Rule.** Guard inside the function's argument, never in the WHERE:
`jsonb_array_elements(CASE WHEN jsonb_typeof(x) = 'array' THEN x ELSE '[]'::jsonb END)`.
It cannot be bypassed by a plan, and it costs nothing.

---

## 2026-11-09 — The `pms_app` role does not survive `down -v`

**Symptom.** `password authentication failed for user "pms_app"` after a
volume reset.

**Cause.** The role is created by `scripts/setup-app-role.sql`, not by a
migration, so dropping the volume drops the role and migrations do not bring it
back.

**Rule.** Any reset sequence that includes `docker compose down -v` must run
the role script after `migration:run` and before `seed`. `start-all.ps1 -Setup`
does this; a hand-typed reset will not unless you remember.

---

## 2026-11-09 — PowerShell turns native stderr into a terminating error

**Symptom.** `start-all.ps1` dies on a Docker warning that is not an error.

**Cause.** Under `$ErrorActionPreference = 'Stop'`, output on stderr from a
native command raises `NativeCommandError`. Docker writes warnings there.

**Rule.** Wrap native calls in `Invoke-Native`, which drops to `Continue` for
the call and restores after. A warning must not be able to stop a script.
