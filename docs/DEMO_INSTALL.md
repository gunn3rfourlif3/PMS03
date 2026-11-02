# Installing the Locare demo on a clean Windows machine

Takes a laptop with nothing on it to a working **Midnight Masquerade** demo.
Allow about 45 minutes, most of it downloads.

This is the setup guide. Once the machine is built, day-to-day running is
`docs/DEMO_RUNBOOK.md`, which is written for someone non-technical.

> `LOCAL_SETUP.md` in the repo root predates this and is **out of date** for a
> demo build: it names Postgres on 5432 and Redis on 6379 (they are 5433 and
> 6380), and tells you to avoid PowerShell, when every script here is
> PowerShell. Use this document for a demo machine; `LOCAL_SETUP.md` is still
> broadly right about the API-only path on WSL.

---

## 1. Prerequisites

Install these in order, from the official sites. All are free.

| What | Version | Notes |
|---|---|---|
| **Git for Windows** | latest | Accept the defaults. Gives you `git` in PowerShell. |
| **Node.js** | 20 LTS or newer | The reference machine runs 22.x. Tick "Automatically install the necessary tools" if offered. |
| **Docker Desktop** | latest | Provides Postgres, Redis and the mail catcher. Needs the WSL2 backend, which its installer sets up; a reboot is normal. |

Check all three from a new PowerShell window:

```powershell
git --version
node -v
npm -v
docker --version
```

If `docker --version` works but `docker info` errors, Docker Desktop is
installed but not started. Open it and wait for **Engine running**.

### Let PowerShell run the scripts

A clean Windows install refuses to run local scripts, so `start-all.ps1` will
fail with *"cannot be loaded because running scripts is disabled on this
system"* until you allow it. Once, per user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Answer `Y`. This allows scripts you wrote or cloned, and still blocks unsigned
scripts downloaded from the internet.

### Machine requirements

16 GB RAM is comfortable; 8 GB works if you run with `-NoMobile`. You need
about 6 GB free disk for the repo, `node_modules` and the Docker images.

---

## 2. Get the code

The repository is **private**, so the machine needs a GitHub account with
access to it. The first `git clone` will open a browser to sign in.

```powershell
cd C:\
mkdir dev -Force
cd C:\dev
git clone https://github.com/gunn3rfourlif3/PMS03.git
cd PMS03
```

Any folder works — this guide uses `C:\dev\PMS03`. On the reference machine it
lives at `C:\xampp\htdocs\development\PMS0.3`, which is historical and not
required.

---

## 3. Configuration — the part that is not in git

**This is the step that catches people out.** Two environment files carry the
demo's settings, and both are deliberately gitignored, so a fresh clone does
not have them. A machine that skips this will start, and then behave oddly in
ways that look like bugs.

### 3.1 The API — `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

The example file is aimed at a plain dev run, not a demo. Change these:

| Key | Set it to | Why |
|---|---|---|
| `OTP_CHANNEL` | `email` | Shipped as `console`, which prints sign-in codes to the API window. The demo reads them from an inbox instead. |
| `SMTP_HOST` | `localhost` | Points at the Mailpit container. |
| `SMTP_PORT` | `1025` | Mailpit's SMTP port. |
| `SMTP_FROM` | `no-reply@midnightmasquerade.demo` | Makes the sign-in email look like it came from the agency, not Locare. |
| `SMTP_FROM_NAME` | `Midnight Masquerade` | Same reason. White-label is the pitch; the email should show it. |
| `JWT_SECRET` | any long random string | Ships as a placeholder. Dev only warns, but sessions behave better with a real one. |
| `PII_ENCRYPTION_KEY` | any long random string | Encrypts owner banking at rest. Leave it empty and anything touching that data will fail at runtime rather than at boot. |

Leave everything else alone. In particular `PAYMENT_PROVIDER=ikhokha` is
already correct — do not change it to Stitch.

> **If you skip `OTP_CHANNEL=email`** the demo still works, but nobody can sign
> in without reading a code off the API console window. That is the single most
> common reason a freshly built demo machine is unusable in front of a
> prospect.

Generating the two secrets, if you want something better than mashing the
keyboard:

```powershell
-join ((48..57) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

Run it twice, paste one into each.

### 3.2 The back office — `web-admin\.env.local`

Most of this file is written for you in step 5 by `demo-mode.ps1`, but one key
is not, and its default is wrong for a demo:

```powershell
notepad web-admin\.env.local
```

Create it if it does not exist, and make sure it contains:

```
NEXT_PUBLIC_VENDOR_SLUG=locare.co.za
```

Without it the code falls back to `dantalan`, and the demo back office brands
itself as a different agency. The value above is what the reference machine
uses — confirm it against that machine rather than assuming, because brand
resolution reads the request host first and this is only the local fallback.

`DEPLOYMENT_PROFILE` and `DEMO_CONSOLE` are added automatically in step 5. Do
not add them by hand.

---

## 4. First build

Start Docker Desktop and wait for **Engine running**. Then:

```powershell
cd C:\dev\PMS03
.\scripts\start-all.ps1 -Setup
```

This takes 10–20 minutes on a clean machine. In order it:

1. checks Docker is running, and stops with a clear message if not;
2. starts Postgres (5433), Redis (6380) and Mailpit (1025 / 8025);
3. waits for Postgres to accept queries, rather than racing it;
4. runs `npm install` in the repo root, `web-admin`, and both Expo apps;
5. applies every database migration;
6. seeds the standard **Demo Agency**;
7. opens a window each for the API, the back office and the two mobile apps.

Add `-NoMobile` to skip the Expo apps — faster, fewer windows, and fine unless
you are demonstrating the tenant and landlord apps.

**It will close anything already listening on 3000, 3001, 8081 or 8082.** On a
clean machine that is nothing. On a developer's machine it may be their work.
Pass `-NoKill` to leave those ports alone.

Leave the windows open. They are the demo running.

---

## 5. Choose the deployment story

```powershell
.\scripts\demo-mode.ps1 a
```

| Argument | Mode |
|---|---|
| `a` | On-site, back office — sealed. Staff only; tenant and landlord sign-in are refused by the API. |
| `b` | On-site, connected — back office on their premises, portals still reachable. |
| `c` | Private server — everything hosted and available. The default. |

This writes `DEPLOYMENT_PROFILE` into **both** `.env` and
`web-admin\.env.local` (the API enforces the mode, the back office decides what
to show — setting one and not the other produces a menu entry the API then
refuses), and sets `DEMO_CONSOLE=1` so the demo console renders.

Run it with no argument to report the current mode and check the two files
agree.

Because this changes environment files, **restart the API and back-office
windows**: Ctrl+C in each, then

- in the **PMS API (3000)** window: `npm run start:dev`
- in the **PMS Web (3001)** window: `npm run dev`

Setting the mode before the first run avoids this; after the first run it is
unavoidable, because `ts-node-dev` watches source files, not `.env`.

---

## 6. Load the Midnight Masquerade world

```powershell
npm run seed:prospect -- midnight-masquerade
```

Builds the whole agency from `demo/profiles/midnight-masquerade.json`: ten
properties, 500 units, staff, the two app logins, and twelve months of invoices
and payments posted through the real double-entry ledger. A few minutes.

It is idempotent on the `midnight-masquerade` slug, so running it again fills
gaps rather than creating a second agency.

This is separate from the `npm run seed` in step 4, which creates the generic
Demo Agency. Both can coexist; the demo uses this one.

---

## 7. Verify before you trust it

Work through all five. Each one fails differently, and finding out in front of
a prospect is expensive.

1. **Back office loads** — http://localhost:3001 shows a sign-in page.
2. **Mail works** — http://localhost:8025 opens Mailpit's inbox, empty.
3. **Sign-in works end to end** — enter `celeste@midnightmasquerade.demo`, then
   check Mailpit. A branded email should arrive within a second or two. Use the
   code. You should land in the back office with the agency's branding, not
   another agency's.
4. **The data is there** — the portfolio map shows 500 units across 10
   properties, and the figures are not all zero.
5. **The demo console renders** — http://localhost:3001/demo. A 404 here means
   `DEMO_CONSOLE` is missing from `web-admin\.env.local`; re-run
   `.\scripts\demo-mode.ps1` with a mode letter.

---

## 8. Optional — Mandarin, for this client only

The Mandarin (zh-Hans) catalogue exists **solely for the Midnight Masquerade
demo**. Non-English locales are off unless a deployment explicitly names one,
so it cannot appear anywhere by accident.

To switch it on for this machine, add to `web-admin\.env.local`:

```
DEPLOYMENT_LOCALE=zh-Hans
```

Restart the back-office window. A language switcher appears, offering English
and Mandarin.

> **Never set `DEPLOYMENT_LOCALE` on the live site or any production
> container.** With it unset — which is every production deployment — the app
> serves English alone, the switcher has nothing to offer, and a stored
> preference for another locale is ignored. That gate is the only thing keeping
> an unreviewed machine translation off the live product.

---

## 9. What ends up running

| Service | Address | Started by |
|---|---|---|
| API | http://localhost:3000 | its own window |
| Back office | http://localhost:3001 | its own window |
| Demo console | http://localhost:3001/demo | back office, when `DEMO_CONSOLE=1` |
| Mail inbox | http://localhost:8025 | Docker (Mailpit) |
| Postgres | localhost:5433 | Docker |
| Redis | localhost:6380 | Docker |
| Tenant app | http://localhost:8081 | Expo, unless `-NoMobile` |
| Landlord app | http://localhost:8082 | Expo, unless `-NoMobile` |

Note the non-standard database ports. They are deliberate, so the stack does
not collide with a Postgres or Redis already installed on the machine.

---

## 10. Troubleshooting

**"running scripts is disabled on this system"** — the execution policy in
section 1. `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**An error mentioning `dockerDesktopLinuxEngine` or "cannot find the file
specified"** — Docker Desktop is not running. Start it, wait for *Engine
running*, and run the command again.

**`npm install` fails on a native package** — check `node -v` is 20 or newer.
Delete `node_modules` and `package-lock.json`, then run `.\scripts\start-all.ps1
-Setup` again.

**The API window loops on `ECONNREFUSED ... 6380`** — Redis is not up. Run
`docker compose ps`; if Redis is missing, `docker compose up -d`.

**No email arrives in Mailpit** — almost always `OTP_CHANNEL` still set to
`console`, or `SMTP_HOST` empty. Check `.env`, then restart the API window.
Setting SMTP without `OTP_CHANNEL=email` does nothing: delivery short-circuits
to a log line before it ever reaches a mail provider.

**`npm run dev` says `Missing script: "dev"`** — you are in the repo root. That
script lives in `web-admin`; `cd web-admin` first.

**The back office shows the wrong agency name** — `NEXT_PUBLIC_VENDOR_SLUG` is
missing from `web-admin\.env.local`, so it fell back to `dantalan`.

**A migration says a relation already exists** — the database is half-built.
Reset it and start over:

```powershell
docker compose down -v
.\scripts\start-all.ps1 -Setup
npm run seed:prospect -- midnight-masquerade
```

`-v` drops the volume, so this destroys all local data. That is fine here —
nothing on this machine is real.

**Port already in use after a crash** — close every demo window and run
`.\scripts\start-all.ps1` again; it clears the old processes out.

---

## 11. Handing the machine over

Once section 7 passes end to end:

1. Open `docs/DEMO_RUNBOOK.md` and walk the whole thing yourself on this
   machine, start to finish. The runbook assumes the install is correct; this
   is where you find out it is.
2. Leave `docs/DEMO_RUNBOOK.md` open, or print it.
3. Tell whoever is presenting that the **first start of the day is the slow
   one**, and to do it before anyone is watching.

The machine needs no internet to run the demo once built — no map tiles, no
external hosts, nothing to configure. It does need Docker Desktop started.
