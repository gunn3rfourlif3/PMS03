# Locare — production hardening runbook

Written 2026-08-19. Covers the three gaps in CLAUDE.md's outstanding list:
no error tracking, no uptime monitoring, and a backup that has never been
restored.

The organising principle: **you have a live agency on production and currently
no way to learn something broke except Dantalan telling you.** Everything here
is about closing that, not about adding features.

---

## 1. Error tracking

### What was built

`src/common/observability/error-reporter.ts` — Sentry behind an interface, the
same shape as every other outbound integration here. Wired into the existing
`AllExceptionsFilter`, reporting **5xx only**: a 401 from a mistyped OTP or a
404 from a stale link is normal operation, and reporting it buries real
failures under noise.

`src/common/observability/scrub.ts` — PII scrubbing, with 36 tests.

### The part that matters: scrubbing lives in our code

POPIA applies to an error payload exactly as it applies to a database row. An
unhandled 500 in the payments module can otherwise carry a tenant's ID number,
an owner's bank account or a live OTP to a processor in another country — and
nobody notices, because nobody reads their own crash reports that closely.

Two deliberate choices:

**Not in the Sentry dashboard.** Provider-side filtering is a setting someone
can change. This is code, reviewed and tested, and it runs first.

**Deny by shape, not only by key name.** Key matching catches `idNumber`; it
does not catch `{ note: "ref 8001015009087" }`. Values shaped like SA ID
numbers, long account numbers, emails, SA phone numbers and six-digit codes are
redacted wherever they appear, at any depth. The bias is toward over-redacting —
a slightly less useful stack trace is a cheap price.

### Setup

The API runs in Docker and the VPS has no Node on the host, so this is a
**local** install committed to the lockfile — the image build runs `npm ci`,
which fails if `package.json` and `package-lock.json` disagree.

```powershell
# on your machine
npm install @sentry/node
git add package.json package-lock.json
git commit -m "Add @sentry/node"
git push
```

Then on the VPS, rebuild — a `restart` will not pick up a new dependency:

```bash
cd ~/PMS03 && git pull
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod build api
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod up -d --force-recreate api
```

And in `deploy/.env.prod`:

```
SENTRY_DSN=https://…@…ingest.sentry.io/…
APP_RELEASE=<git sha, optional but useful>
```

Unset, the reporter logs a line at boot and does nothing else. `@sentry/node`
absent, same. **Error tracking must never be the reason a request fails.**

### Before switching it on

Sentry is a third-party processor receiving data about your users. Two things
that belong on the POPIA list alongside the registered-entity item:

- a **DPA / processor agreement** with Sentry (they publish one)
- a line in the privacy policy naming them as a processor

Both are quick, and both are cheaper before a customer asks than after.

### Hosted, not self-hosted

Self-hosting GlitchTip on the same VPS is tempting and wrong: a monitor that
dies with the box it monitors tells you nothing on the day you need it.

---

## 2. Uptime monitoring

No code needed — the endpoints already exist.

| Endpoint | Meaning | Monitor? |
|---|---|---|
| `GET /api/health` | Process is alive. No dependencies touched. | Secondary |
| `GET /api/health/ready` | Postgres **and** Redis reachable. 503 if not. | **Primary** |

**Point an external monitor at `https://api.locare.co.za/api/health/ready`**,
every 60 seconds, alerting after two consecutive failures. UptimeRobot's free
tier does this; so does Better Stack. Any of them is fine — the requirement is
only that it runs somewhere other than the Contabo box.

Worth also monitoring, because they fail independently and users notice before
you do:

- `https://app.locare.co.za` — the back-office (Next.js can be down while the API is up)
- `https://locare.co.za` — marketing, where prospects land
- `https://rentals.dantalan.co.za` — the public rentals site

Set alerts to email **and** WhatsApp or SMS. An email alert at 02:00 is an
email you read at 08:00.

### Certificate expiry

Caddy renews automatically, but a failed renewal is silent until the site
breaks. Most monitors check certificate expiry — turn it on, 14 days' notice.

---

## 3. Backups — proving them, not assuming them

`deploy/backup.sh` dumps nightly and keeps 14 days — *if* something calls it.

> **2026-08-20: it wasn't.** The first run of `restore-test.sh` on production
> returned `FAIL: no backup found`. `deploy/backups` was empty. The script had
> existed for weeks and had never once been executed, so at that moment
> production had **zero** backups of a live agency's data.
>
> This is exactly the failure the restore test is for, and it found it on the
> first run — before a disk did.

### Confirm cron is actually running it

```bash
crontab -l | grep backup
ls -lht ~/PMS03/deploy/backups | head -5
```

Expect a dump from last night. **An empty directory means you have no backups
at all**, not that backups are merely untested. To install:

```bash
chmod +x ~/PMS03/deploy/backup.sh
~/PMS03/deploy/backup.sh          # take one NOW, don't wait for 02:00
crontab -e
# 0 2 * * *  /home/deploy/PMS03/deploy/backup.sh >> /home/deploy/backup.log 2>&1
```

Check the log a day later. A cron job that fails silently is the same as no
cron job, and `docker compose` needs an absolute path plus a `PATH` that
includes it — which is why the log redirect is not optional.

### Test the restore

```bash
cd ~/PMS03/deploy
chmod +x restore-test.sh
./restore-test.sh
```

It restores the newest dump into a **throwaway** database beside production,
verifies it, and drops the copy. Production is never touched.

What it checks, and why each one earns its place:

| Check | Catches |
|---|---|
| Tables and migration rows present | A dump of the wrong database, or a schema nobody can later upgrade |
| Row counts in vendors, users, leases, invoices, ledger | A backup that "succeeded" against an empty database |
| `rowsecurity` true on tenant tables | A restore that silently lost RLS — which would hand every agency everyone else's data |
| `tenant_isolation` policies present | Same, from the policy side |
| SECURITY DEFINER webhook functions | Payment and mandate webhooks failing to resolve a vendor after a restore |
| Ledger transactions all balance | A dump truncated mid-write, which a row count cannot see |

**Run it monthly, and after any change to `backup.sh`.** Record the date it
last passed.

### The gap this does not close

The dumps live on the same VPS as the database. A disk failure or a lost
Contabo account takes both. **Copy them off the box** — Backblaze B2, Hetzner
Storage Box, or an `rclone` job to any S3-compatible bucket. That is the
difference between surviving a bad migration and surviving a dead server.

Not built here because it needs an account and a credential decision, but it is
the single largest remaining hole in the recovery story.

---

## 4. What is still missing after this

Honest list, roughly in order of what would hurt.

1. **Off-site backup copies** (§3) — the biggest one. Parked on a decision, not
   on work: an `rclone` job on the same 02:00 cron is an afternoon. The open
   questions are the target (Hetzner Storage Box ~€4/mo in Germany, Backblaze
   B2, or Cloudflare R2) and whether to `age`-encrypt before upload. Encrypting
   means the provider only ever holds ciphertext, which largely removes the
   POPIA cross-border processor question — at the cost of a key that must live
   somewhere other than the VPS, with the same lose-it-lose-everything property
   as `PII_ENCRYPTION_KEY`.
2. **A restore *drill*, not just a restore test.** The script proves the dump is
   good. It does not prove you can rebuild the whole stack on a new box inside
   an acceptable window. Worth doing once, timed, and writing down.
3. **Structured log retention.** Logs live in the container; a restart loses
   them. Fine today, painful the first time you investigate something from last
   week.
4. **Alert on queue depth.** BullMQ backing up means invoices, dunning and
   notifications have quietly stopped. Nothing watches this.
5. **`PII_ENCRYPTION_KEY` rotation runbook.** CLAUDE.md warns rotation makes
   existing data unreadable. There is no documented decrypt-and-re-encrypt
   procedure, and now three tables depend on it — owner banking, partner KYC,
   and mandate banking.
