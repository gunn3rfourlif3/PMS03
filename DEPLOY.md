# Deploying PMS 0.3

CI/CD is GitHub Actions. Two workflows live in `.github/workflows/`.

## CI — `ci.yml`
Runs on every push to `main` and every pull request:

- **API job**: `npm ci` → lint (non-blocking) → `npm test` (Jest, 67 unit tests) → `npm run build` (compiles `src/` via `tsconfig.build.json`, which is the real type-check gate).
- **Web job**: `npm ci` → `next lint` (non-blocking) → `next build` (type-checks + bundles the console).

A red build blocks the merge.

## Deploy — `deploy.yml`
Runs on a version tag (`v*`) or manual dispatch:

1. Builds two Docker images and pushes them to **GHCR**
   (`ghcr.io/<owner>/<repo>-api` and `-web`), tagged with the semver, the commit
   SHA, and `latest`. Auth uses the built-in `GITHUB_TOKEN` — no extra secrets.
2. A `deploy` job (GitHub *production* environment — add required reviewers /
   secrets there) is the hook to roll out to your host. It's intentionally a
   placeholder: wire it to SSH + `docker compose pull && up -d`, `kubectl`/Helm,
   or a managed-platform deploy hook.

**Always run migrations before or during rollout:** `npm run migration:run`.

## Images
- `Dockerfile` (root) — API. Multi-stage: build → `node dist/main` on `node:20-alpine`, with a `/api/health` HEALTHCHECK.
- `web-admin/Dockerfile` — Next.js **standalone** output (`output: 'standalone'`), served by `node server.js`.

## Local production run
```bash
export JWT_SECRET=... PII_ENCRYPTION_KEY=...
docker compose -f compose.prod.yml up --build
# API :3000  ·  Web :3001  ·  Postgres :5432  ·  Redis :6379
```

## Health / readiness probes
- `GET /api/health` — liveness (process up).
- `GET /api/health/ready` — readiness: checks Postgres + Redis, returns `503` when a dependency is down. Point your load balancer / Kubernetes probes here.

## Required production env
Set these (see `.env.example` for the full list):

| Var | Why |
| --- | --- |
| `JWT_SECRET` | signs auth tokens — must be strong & stable |
| `PII_ENCRYPTION_KEY` | encrypts owner banking at rest — **stable & secret**; if it changes, encrypted data is unreadable |
| `DATABASE_URL` / `REDIS_URL` | datastores |
| `PAYMENT_PROVIDER` | collection rail: stitch \| paystack \| payfast \| yoco \| peach |
| `PAYOUT_PROVIDER` | owner-payout rail: paystack \| stitch (collection gateways can't pay out) |
| gateway keys (`PAYSTACK_*`, `PAYFAST_*`, `YOCO_*`, `PEACH_*`) | live payments (blank ⇒ safe stub) |
| `SENDGRID_API_KEY` / `TWILIO_*` | real email / SMS (blank ⇒ console stub) |
| `ESIGN_API_URL` / `ESIGN_API_KEY` | real e-sign (blank ⇒ native stub) |
| `*_WEBHOOK_SECRET` | verify inbound provider webhooks |

Every external integration **degrades to a safe local stub when its
credentials are absent**, so CI and dev need no secrets.
