# PMS 0.3 — Local Setup Guide

This walks you from a fresh clone to a running API with a seeded demo tenant, then through a full end-to-end smoke test (list a unit → approve an applicant → bill them → take payment). Every command is copy-pasteable.

Expect ~15 minutes the first time (most of it `npm install`).

---

## 0. Prerequisites

Install these first:

- **Node.js 20 LTS** (`node -v` should print `v20.x`). Other 20+ versions are fine.
- **Docker Desktop** (for Postgres + Redis). Make sure it's running.
- A terminal. **On Windows, use WSL2 (Ubuntu) or Git Bash**, not plain `cmd`/PowerShell — the `curl` examples and shell syntax below assume a bash-like shell. Docker Desktop's WSL2 backend works great here.

> You do **not** need to install Postgres or Redis yourself — Docker provides them. You also don't need any Stitch/Paystack/S3 credentials: those providers run as dev stubs by default.

---

## 1. Get the project and install dependencies

```bash
cd PMS0.3
npm install
```

`npm install` pulls the full NestJS + TypeORM + BullMQ + AWS SDK toolchain, so it takes a few minutes. A few `npm warn` lines are normal; there should be no `npm error`.

---

## 2. Start Postgres and Redis

```bash
docker compose up -d
```

This launches Postgres 16 on `localhost:5432` and Redis 7 on `localhost:6379`. Verify both are up:

```bash
docker compose ps
```

You should see `postgres` and `redis` with state `running`/`healthy`.

---

## 3. Configure environment

```bash
cp .env.example .env
```

The defaults already point at the Docker Postgres/Redis and select the **dev stub** providers (`STORAGE_DRIVER=local`, `PAYMENT_PROVIDER=stitch` stub, `OTP_CHANNEL=console`). Nothing to edit for a local run. (For a real deployment you'd fill in the S3/Stitch/Paystack/e-sign values and set `JWT_SECRET`.)

---

## 4. Create the schema (run migrations)

```bash
npm run migration:run
```

This applies all seven migrations in order. It creates every table, **enables and forces Row-Level Security** with per-tenant policies, installs the append-only ledger guards, and creates the `SECURITY DEFINER` helper functions (auth bootstrap, billing worklist, dunning worklist). You'll see a line per migration ending with `Migration ... has been executed successfully`.

---

## 5. Seed a demo tenant

```bash
npm run seed
```

This inserts a demo **agency vendor** (with a valid Fidelity Fund Certificate + trust account so the PPRA gate passes), an **owner user** with a `vendor_owner` membership, and a **property with one vacant unit**. It prints the IDs and the login email:

```
loginEmail: owner@demo.test
unitId:     <uuid>   <- you'll use this below
```

Copy the `unitId` — you'll need it in the smoke test.

> Without this step, RLS-scoped endpoints correctly return nothing (no vendor context), so don't skip it.

---

## 6. Run the API

```bash
npm run start:dev
```

Watch for `PMS API listening on :3000`. Leave this terminal running — the OTP codes and job logs print here. Open a **second terminal** for the smoke test.

Quick health check (second terminal):

```bash
curl -s localhost:3000/api/billing/health
# {"status":"Billing module ready"}
```

---

## 7. End-to-end smoke test

This exercises the whole spine: auth → listing → applicant funnel → lease → billing → payment. Run these in your second terminal.

### 7.1 Log in (passwordless OTP)

```bash
# request a code — it prints to the SERVER console (first terminal) as: [OTP] owner@demo.test -> 123456
curl -s -X POST localhost:3000/api/auth/otp/request \
  -H 'content-type: application/json' \
  -d '{"destination":"owner@demo.test"}'
```

Grab the 6-digit code from the server terminal, then verify to get a token:

```bash
curl -s -X POST localhost:3000/api/auth/otp/verify \
  -H 'content-type: application/json' \
  -d '{"destination":"owner@demo.test","code":"PASTE_CODE"}'
# {"accessToken":"eyJ..."}
```

Save the token to a variable (paste the value):

```bash
TOKEN="eyJ..."
```

### 7.2 Create and publish a listing for the vacant unit

Use the `unitId` from the seed output:

```bash
UNIT_ID="PASTE_UNIT_ID"

LISTING=$(curl -s -X POST localhost:3000/api/listings \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"unitId\":\"$UNIT_ID\",\"advertisedRent\":8000,\"availableFrom\":\"2026-08-01\",\"description\":\"2-bed, Unit 101\"}")
echo "$LISTING"
LISTING_ID=$(echo "$LISTING" | sed -E 's/.*"id":"([^"]+)".*/\1/')

curl -s -X POST "localhost:3000/api/listings/$LISTING_ID/publish" -H "authorization: Bearer $TOKEN"
```

### 7.3 Applicant applies (public, no auth), then screen + approve

```bash
APP=$(curl -s -X POST localhost:3000/api/listings/applications \
  -H 'content-type: application/json' \
  -d "{\"listingId\":\"$LISTING_ID\",\"applicantName\":\"Thabo M\",\"applicantEmail\":\"thabo@demo.test\",\"applicantPhone\":\"+27820000009\"}")
APP_ID=$(echo "$APP" | sed -E 's/.*"id":"([^"]+)".*/\1/')

# screen (returns an approve/review/decline recommendation)
curl -s -X POST "localhost:3000/api/listings/applications/$APP_ID/screen" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"monthlyIncome":30000,"creditScore":710}'

# approve -> provisions tenant user + active lease, unit becomes occupied, listing filled
curl -s -X POST "localhost:3000/api/listings/applications/$APP_ID/approve" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"startDate":"2026-08-01"}'
```

### 7.4 Bill the tenant and take a payment

```bash
# generate invoices for the period (async job; watch the server log for "Generated N invoices")
curl -s -X POST localhost:3000/api/billing/run \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"period":"2026-08","dueDate":"2026-08-07"}'
```

Find the invoice id (quick peek via psql — see §9), then:

```bash
INVOICE_ID="PASTE_INVOICE_ID"

# tenant initiates payment (Stitch stub returns a pay-by-bank URL + pending payment)
PAY=$(curl -s -X POST "localhost:3000/api/payments/invoices/$INVOICE_ID/initiate" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"method":"eft"}')
echo "$PAY"

# simulate the provider webhook confirming success -> posts Dr Bank / Cr AR, invoice -> paid
GATEWAY_REF=$(echo "$PAY" | sed -E 's/.*"paymentId".*//')  # or read gatewayRef from the payments table
curl -s -X POST localhost:3000/api/payments/webhook/stitch \
  -H 'content-type: application/json' \
  -d "{\"gatewayRef\":\"PASTE_GATEWAY_REF\",\"status\":\"succeeded\"}"
```

You've now driven the full lifecycle. The server log shows the invoice, the notification fan-out, and the payment settlement; the ledger holds balanced entries for each.

---

## 8. Run the unit tests

```bash
npm test
```

The eleven suites (ZA policy, OTP, double-entry, invoice math, payments, deposits, owner statements, notifications, documents, expenses, screening/transitions) should all pass.

---

## 9. Peeking at the database (optional but useful)

Open a psql shell inside the Postgres container:

```bash
docker compose exec postgres psql -U pms -d pms
```

Handy queries (RLS is bypassed here because you're the DB superuser):

```sql
-- find the invoice + its gateway ref for the payment step
SELECT id, period, total, status FROM invoices ORDER BY created_at DESC LIMIT 5;
SELECT gateway_ref, status, amount FROM payments ORDER BY created_at DESC LIMIT 5;

-- prove the ledger is balanced for a transaction
SELECT transaction_id, SUM(debit) AS dr, SUM(credit) AS cr
FROM ledger_entries GROUP BY transaction_id;   -- dr should equal cr for every row

-- see the unit flip to occupied after approval
SELECT label, status FROM units;
```

Exit psql with `\q`.

---

## 10. Troubleshooting

**`npm install` fails on a specific package** — ensure Node is 20+ (`node -v`). Delete `node_modules` and `package-lock.json`, then `npm install` again.

**App exits immediately with a Postgres/Redis connection error** — Docker isn't running or the containers aren't up. `docker compose up -d`, then `docker compose ps`. If port 5432 or 6379 is already taken by a local Postgres/Redis, stop that service (or change the ports in `docker-compose.yml` and `.env`).

**`migration:run` says a relation already exists** — the schema was partially created. Reset the database: `docker compose down -v` (the `-v` drops the volume) then `docker compose up -d && npm run migration:run && npm run seed`.

**Endpoints return `[]` or 403 even with a token** — you skipped the seed, or your token has no vendor context. Re-run `npm run seed`, log in again as `owner@demo.test`, and use the fresh token.

**`Cannot find module '@modules/...'`** — path aliases aren't resolving. The scripts already register `tsconfig-paths` (dev/migrations) and `tsc-alias` (prod build); make sure you're invoking them via `npm run ...`, not calling `node`/`ts-node` directly.

**`ts-node` complains about a type error on migrate** — set transpile-only for that command: `TS_NODE_TRANSPILE_ONLY=1 npm run migration:run` (bash/WSL/Git Bash).

**Windows: `curl` behaves oddly in PowerShell** — use WSL2 or Git Bash, or call `curl.exe` explicitly.

**Reset everything and start clean:**

```bash
docker compose down -v
docker compose up -d
npm run migration:run
npm run seed
npm run start:dev
```

---

## What's running (recap)

- **API**: NestJS modular monolith on `:3000`, all routes under `/api`.
- **Postgres**: schema with forced RLS per vendor + an append-only double-entry ledger.
- **Redis + BullMQ**: recurring billing (monthly), dunning (daily), and notification fan-out.
- **Providers**: Stitch/Paystack (payments), local storage + native e-sign, and console SMS/email — all dev stubs, swappable via env for production.

For the architecture and per-module detail, see `README.md` and `docs/SPEC.md`.
