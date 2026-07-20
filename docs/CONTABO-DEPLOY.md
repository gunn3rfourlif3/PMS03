# Deploying PMS 0.3 to Contabo (Cloud VPS 6, Ubuntu)

Target server (yours): `vmi3453343`, **169.58.46.223** (IPv6
`2a02:c207:2345:3343::1`), root login, 200 GB disk, EU. Runtime: **Docker
Compose** behind **Caddy** with automatic HTTPS. Everything below is copy-paste.

Assets referenced live in `deploy/`: `Caddyfile`, `compose.prod.yml`,
`.env.prod.example`, `harden.sh`, `backup.sh`.

---

## 0. DNS first (do this now — cert issuance needs it)
At your domain registrar, create records pointing at the VPS:

```
A     app.example.com   ->  169.58.46.223
A     api.example.com   ->  169.58.46.223
AAAA  app.example.com   ->  2a02:c207:2345:3343::1     (optional, IPv6)
AAAA  api.example.com   ->  2a02:c207:2345:3343::1     (optional)
```

Replace `example.com` with your real domain. Let it propagate (a few minutes).
Caddy will fetch Let's Encrypt certificates for these two hostnames automatically
on first start.

---

## 1. Harden the box (once, as root)
SSH in with the Contabo root password, then run the hardening script with **your**
SSH public key so you get key-only access to a non-root `deploy` user:

```bash
ssh root@169.58.46.223
# paste harden.sh onto the box (scp it, or clone the repo first), then:
bash harden.sh "ssh-ed25519 AAAA...your-public-key... you@laptop"
```

This updates the system, creates the `deploy` sudo user, enables the UFW firewall
(SSH/80/443 only), turns on fail2ban + unattended security upgrades, disables root
& password SSH login, and installs Docker + the Compose plugin.

> **Contabo panel:** Contabo VPS have no external cloud firewall by default, so
> UFW on the box is your firewall. If you later enable Contabo's firewall add-on,
> allow TCP 22/80/443 (and UDP 443 for HTTP/3) there too.

Log back in as the new user (key-only):

```bash
ssh deploy@169.58.46.223
```

---

## 2. Get the code
```bash
git clone <your-repo-url> pms && cd pms
# (or copy the project up with rsync/scp)
```

---

## 3. Configure secrets
```bash
cp deploy/.env.prod.example deploy/.env.prod
openssl rand -hex 32   # -> paste as JWT_SECRET
openssl rand -hex 32   # -> paste as PII_ENCRYPTION_KEY
nano deploy/.env.prod
```

Fill in: your domains (`CORS_ORIGINS=https://app.example.com`,
`NEXT_PUBLIC_API_BASE=https://api.example.com/api`), a strong
`POSTGRES_PASSWORD`, the two generated secrets, and an **OTP channel**
(see §6 — the app will refuse to boot in production without a working one).

Then edit `deploy/Caddyfile`: replace `app.example.com`, `api.example.com` and the
`email` with your real values.

> **Keep `PII_ENCRYPTION_KEY` stable and secret forever.** If it changes, every
> encrypted banking record becomes unreadable.

---

## 4. Build & start the stack
```bash
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod up -d --build
```

Only Caddy publishes ports (80/443); Postgres, Redis, the API and the web app stay
on the internal Docker network. Watch it come up:

```bash
docker compose -f deploy/compose.prod.yml logs -f caddy api
```

---

## 5. Initialise the database (once)
Create the least-privileged runtime role, run migrations, and seed:

```bash
cd pms
# app role + RLS policies helper:
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod \
  exec -T postgres psql -U pms -d pms < scripts/setup-app-role.sql

# migrations + demo data (run inside the api container so it uses the same env):
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod exec api npm run migration:run
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod exec api npm run seed   # optional demo data
```

Now browse to **https://app.example.com** and check **https://api.example.com/api/health/ready** returns `ok`.

---

## 6. One-time passwords (required for login)
Production login is passwordless OTP, and the app **refuses to start with
`OTP_CHANNEL=console`** (that would print codes into the logs). Pick one:

- **Email** — set `OTP_CHANNEL=email` and `SENDGRID_API_KEY` + `SENDGRID_FROM`.
- **SMS** — set `OTP_CHANNEL=sms` and `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM`.

The API delivers the code through that channel (email destinations → email, phone
→ SMS). Without provider credentials for the chosen channel, the boot-time guard
stops the app with a clear message — by design.

---

## 7. Payments (when going live)
Set `PAYMENT_PROVIDER` (payfast / yoco / peach / paystack / stitch) and the
matching keys in `.env.prod`, plus `PAYOUT_PROVIDER` for owner payouts. Point each
gateway's webhook at `https://api.example.com/api/payments/webhook/<provider>` and
set the corresponding `*_WEBHOOK_SECRET`. Run one sandbox transaction per gateway
before taking real money.

---

## 8. Backups
```bash
# nightly pg_dump at 02:00, 14-day retention:
( crontab -l 2>/dev/null; echo "0 2 * * * $HOME/pms/deploy/backup.sh" ) | crontab -
```

Contabo also offers an **Auto Backup** add-on (whole-disk snapshots) — worth
enabling in addition to the logical DB dumps for defence in depth.

---

## 9. Day-to-day
```bash
# update to a new release
git pull
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod up -d --build
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod exec api npm run migration:run

# restart / stop / logs
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod restart api
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod logs -f api
```

---

## 10. Automated deploys on a tagged release (CI/CD over SSH)
`.github/workflows/deploy.yml` builds & pushes images to GHCR, then SSHes into
this VPS and rolls them out with `deploy/compose.prod.images.yml` (it pulls the
images rather than building on the 2-core box), runs migrations, and checks
`/api/health/ready`.

**One-time setup**

1. On the box, as the `deploy` user, clone the repo where the workflow expects it
   and fill in secrets there:
   ```bash
   cd ~ && git clone <your-repo-url> pms && cd pms
   cp deploy/.env.prod.example deploy/.env.prod && nano deploy/.env.prod
   ```
2. Create a **CI deploy SSH key** and authorise it for the `deploy` user:
   ```bash
   ssh-keygen -t ed25519 -f ci_deploy -N ""      # on your laptop
   ssh-copy-id -i ci_deploy.pub deploy@169.58.46.223
   ```
3. In the GitHub repo, add **Settings → Secrets and variables → Actions**:

   | Secret | Value |
   | --- | --- |
   | `VPS_HOST` | `169.58.46.223` |
   | `VPS_USER` | `deploy` |
   | `VPS_SSH_KEY` | contents of the private `ci_deploy` key |
   | `VPS_APP_DIR` | `/home/deploy/pms` |
   | `GHCR_USER` | your GitHub username |
   | `GHCR_TOKEN` | a PAT with `read:packages` (so the box can pull images) |

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_BASE` | `https://api.example.com/api` (baked into the web image) |

   Optionally add required reviewers to the **production** environment so a
   release must be approved before it deploys.

**Trigger a deploy**
```bash
git tag v1.0.0
git push origin v1.0.0        # builds images, then deploys to the VPS
```
Or run the *Deploy* workflow manually (workflow_dispatch). The first manual §1–§9
bootstrap is still needed once (server, DNS, secrets, DB init); after that, tagged
releases roll out automatically.

---

## Troubleshooting
- **App exits immediately on boot** — the production env guard rejected the config.
  The log names the exact problem (missing `JWT_SECRET`/`PII_ENCRYPTION_KEY`,
  `CORS_ORIGINS`, or an OTP channel without provider creds). Fix `.env.prod` and
  `up -d` again.
- **Cert / TLS errors in Caddy** — DNS isn't pointing at the VPS yet, or ports
  80/443 are blocked. Confirm `dig app.example.com` returns 169.58.46.223 and UFW
  allows 80/443.
- **`password authentication failed`** — `POSTGRES_PASSWORD` in `.env.prod` doesn't
  match the volume's initialised password. For a fresh DB, remove the `pgdata`
  volume and re-up; for an existing one, use the original password.
- **CORS errors in the browser** — `CORS_ORIGINS` must exactly equal the web
  origin (`https://app.example.com`, no trailing slash).
