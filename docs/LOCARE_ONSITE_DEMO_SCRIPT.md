# Locare on-site demo — running order

Written 2026-10-08. Owner: Vernon. Prospect: **Midnight Masquerade**.
Read with `LOCARE_ONSITE_CLIENT_OPTIONS.md` and `LOCARE_ONSITE_DEMO_BUILD_PLAN.md`.

> ## ⚠ PROVISIONAL — written before the walkthrough
>
> Days 3–7 of the build plan were verified by typechecks and unit specs only.
> At the time of writing, **no part of the mode switch has run against a booted
> stack.** This running order is therefore what the software is *designed* to
> do, not what anyone has watched it do.
>
> Walk it with the checklist at the bottom before you put it in front of a
> client, and correct this file from what actually happens. The specific things
> most likely to be wrong are listed there.

---

## Running it locally (no VPS)

This is the path to use on Vernon's machine. The stack in `deploy/demo/` is for
the VPS — it joins the production Docker network so the live Caddy can route to
it, and that network does not exist here. The ordinary dev stack runs the same
code against the same database, which is all the demo needs.

```powershell
docker stop hms-postgres 2>$null      # it fights Locare for 5433
docker compose up -d
npm run migration:run
npm run seed:prospect -- midnight-masquerade   # idempotent
.\scripts\demo-mode.ps1 c
.\scripts\start-all.ps1
```

Then `http://localhost:3001`, sign in as `celeste@midnightmasquerade.demo`.

**Four differences from the VPS version of this script, all of them things that
would otherwise trip you up mid-sentence:**

- **No Mailpit.** OTP codes print to the *PMS API (3000)* window as an `[OTP] …`
  line. That is the only plaintext copy — the stored code is hashed. Worth
  having that window visible if you plan to show the sign-in.
- **Switching modes needs a restart.** `ts-node-dev` watches source files, not
  `.env`, so the API will not notice. Ctrl+C and re-run in both the API and Web
  windows. Perhaps fifteen seconds, not the VPS's three — rehearse the line you
  say while it comes back.
- **Two files, not one.** `demo-mode.ps1` writes `DEPLOYMENT_PROFILE` into both
  `.env` (the API, which enforces) and `web-admin/.env.local` (the web, which
  only decides what to show). Run with no argument to check they agree.
- **Hosts are localhost.** Back office on `:3001`, API on `:3000`, tenant and
  landlord Expo apps on `:8081` and `:8082` if you start them. There is no
  `tenant.demo.locare.co.za` to open, so the refused-tenant-login moment is done
  against the Expo app or with a direct API call.

Everything below describes the demo itself and applies either way; where it
names a `demo.locare.co.za` host, use the localhost equivalent.

---

## Before the room

Up to a day ahead, not on the morning:

On the VPS:

```bash
cd ~/PMS03
git pull origin main
docker compose -p demo -f deploy/demo/compose.demo.yml --env-file deploy/demo/.env.demo up -d --build
npm run seed:prospect -- midnight-masquerade     # idempotent; safe to re-run
./deploy/demo/mode.sh c                          # open in C
```

Locally, the block in the section above instead.

Then check two things that are easy to forget and visible from the back row:

- Their **logo and colours** are still placeholders (`demo/profiles/midnight-masquerade.json`,
  open item (b)). A demo branded Locare-green to a prospect called Midnight
  Masquerade undercuts the white-label pitch in the first ten seconds.
- The **dates are current.** The profile generates everything as an offset from
  the seed run, so a world seeded three weeks ago shows three-week-old arrears.
  Re-seed if it has been sitting.

Have open: the back office, Mailpit (`mail.demo.locare.co.za`), and a terminal
on the VPS for the mode switch.

---

## The running order

**Open in C (Private server).** Deliberately. C is the full product and the
least loaded start: nothing is missing, so the first ten minutes are about what
Locare does rather than what an option costs. It is also, per the client note,
often what a client actually means by "on our own server".

### 1. The portfolio — about 5 minutes

Sign in as `celeste@midnightmasquerade.demo`. OTP lands in Mailpit; open it on
screen. "This is the exact email your staff receive" is worth the ten seconds.

Show the scale first: 500 units, ten buildings, twelve months of history. Then
land on something specific rather than scrolling — scrolling a 500-unit list is
the weakest thing in the demo (known issue, see the checklist).

- **The Carnival 212** — Lerato Mokoena, in arrears.
- **Harlequin Court 7B** — Jason Pillay, further behind.
- **Masquerade Heights 304** — the geyser leaking into the ceiling.
- **Pierrot Gardens 4** — lease expiring, 54 days.
- **Columbine Lofts 22** — a lease sent and awaiting signature.

### 2. The ledger — about 5 minutes

This is the part that is hard to fake and the part being sold. Every invoice and
payment behind those twelve months was posted double-entry; statements reconcile
because the postings balance, not because a report was written to agree with
itself.

If they are an agency that has been burned by a system whose numbers drifted,
spend longer here than feels necessary.

### 3. The question — whenever it comes

It will come as some version of *"where does our data actually live?"* Do not
pre-empt it. When it arrives, that is the cue.

Open **`/demo`** on the back office. It states the live mode, where the data
sits, who runs it, and a served/not-served line per capability.

### 4. The switch — about 10 minutes

```bash
./deploy/demo/mode.sh a           # VPS
```
```powershell
.\scripts\demo-mode.ps1 a        # local, then restart both dev windows
```

Keeps the data either way: no reseed, no rebuild. Say that out loud
— "same database, same agency, same twelve months" — because the obvious
suspicion is that you have swapped to a different demo.

Reload. Now:

- **Listings and Applications are gone from the menu.** Not greyed out. Absent.
- `/demo` shows the sealed column: tenant sign-in not served, landlord sign-in
  not served, public listings not served, bank-statement import instead of card
  and instant EFT, print and sign instead of e-signature.
- **Staff work is untouched.** Go back to the arrears and the maintenance job.
  Everything their own people do at their own desks still works.

Then the part that answers the question they have not asked yet: open the tenant
app at `tenant.demo.locare.co.za` and **attempt to sign in as
`tenant@demo.locare.co.za`**. It is refused by the server, naming the mode.

That is the whole demo in one gesture. The feature is not hidden behind a menu;
the installation does not serve it.

### 5. B, briefly — about 3 minutes

```bash
./deploy/demo/mode.sh b           # VPS
```
```powershell
.\scripts\demo-mode.ps1 b        # local
```

Everything comes back. B is C's feature set on their hardware — the difference
is topology, not product. Say plainly that B is the one with real IT effort: one
address published to the internet, and the four things on the `/demo` page are
theirs to supply.

### 6. Land it

Three options, one trade-off. A is the strict reading of "on our premises" and
costs them tenant self-service. B is everything, on their hardware, with real IT
work. C is everything, run by us, with their own database.

Leave `/demo` on screen in whichever mode their faces said they wanted.

---

## Bring back seven answers

The whole point of the meeting. None of these are answered yet, and the demo is
currently built on the hardest reading of each.

1. **Why on-site?** Policy, a regulator, or a preference — the real reason may be
   answered by C.
2. **Do tenants and landlords need logins?** The whole difference between A and B.
3. **How do tenants pay rent today?** If it is manual EFT already, A changes
   nothing for them.
4. **Who is their IT** — a department, a provider, or a relative?
5. **Is there a server, or must one be bought?**
6. **How many users, properties and leases?** (The demo assumes 500 units.)
7. **Who signs, and by when?**

---

## Verification walk — do this before the room

Tick these off. Each one is a thing the build plan asserts and nobody has seen.

### Mode C

- [ ] Stack comes up; `mode.sh` / `demo-mode.ps1` with no argument reports the live mode
      (locally it reports BOTH files and warns if they disagree).
- [ ] Staff sign-in works; OTP arrives in Mailpit (VPS) or the API window (local).
- [ ] All five story records open: both arrears, both maintenance jobs, the
      expiring lease, the awaiting-signature lease.
- [ ] Tenant and landlord sign-in both work (Expo apps on :8081/:8082 locally).
- [ ] `/demo` renders and shows everything served.

### Mode A — the one that matters

- [ ] The switch to A completes (seconds on the VPS; a dev-server restart locally).
- [ ] **The data survived.** Same vendor, same 500 units, same arrears dates.
- [ ] Listings and Applications are gone from the nav.
- [ ] The sidebar shows the "On-site, back office" chip.
- [ ] Staff sign-in still works.
- [ ] **Tenant sign-in is refused**, with a message naming the mode — not a 500,
      not a blank page, not a silent hang.
- [ ] Landlord sign-in likewise.
- [ ] Public listings endpoints return 403.
- [ ] `/demo` shows the sealed column.

### Mode B

- [ ] Switch to B; everything from C is back.
- [ ] Tenant sign-in works again.
- [ ] The chip reads "On-site, connected".

### Production is unaffected

- [ ] `app.locare.co.za` still behaves exactly as before. `DEPLOYMENT_PROFILE`
      is unset there, which resolves to `private_server`.

### Most likely to be wrong

In rough order of how much it would cost you mid-demo:

1. **The web and API reading `DEPLOYMENT_PROFILE` separately.** One compose
   variable feeds both, but nothing enforces that they agree. A mismatch shows a
   menu entry the API refuses.
2. **`mode.sh` has never run.** The `--no-deps` behaviour, the `sed` into
   `.env.demo`, and the `exec printenv` path are all untested.
3. **The tenant-app refusal.** The API refuses correctly in unit tests; whether
   the Expo tenant app renders that 403 as a sentence or as a crash is unknown.
4. **`/demo` 404ing when it should render**, or rendering when it should 404 —
   `DEMO_CONSOLE` is set in one place and tested nowhere.
5. **The 500-unit list** with no pagination. Known, logged against the utilities
   plan's Day 3, not fixed here.
6. **Locally only: the two env files drifting.** `demo-mode.ps1` writes both, but
   if you ever set one by hand the back office and the API disagree. Running the
   script with no argument reports both and says so.
