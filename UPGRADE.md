# Dependency upgrade: NestJS 10 → 11

## Why
`npm audit` reports 14 vulnerabilities (3 high, 11 moderate). **Every one of them
resolves to a single root cause: the project is on the NestJS 10 line.** The
advisories arrive transitively through `@nestjs/core`, `@nestjs/platform-express`
(→ express/body-parser/qs/multer) and `@nestjs/config` (→ lodash).

## Reachability assessment (do this before panicking)
Severity ≠ exploitability. For *this* codebase:

| Advisory | Severity | Reachable here? |
| --- | --- | --- |
| `multer` DoS | high | **No.** No `FileInterceptor` / `UploadedFile` / multipart anywhere — documents use pre-signed storage URLs. Multer is never invoked. |
| `lodash` `_.template` code injection | high | **No.** Not a direct dependency; used internally by `@nestjs/config` for config lookups, never with user input. |
| `qs` / `body-parser` / `express` DoS | moderate | **Low.** The advisory targets `qs.stringify` with `encodeValuesOnly`; the server parses, and requests are rate-limited (120/min global, 5–10/min on auth). |
| `uuid` bounds check | moderate | **No.** Only the `buf` argument form of v3/v5/v6 is affected; TypeORM uses v4. |

So this is a **hygiene upgrade, not an active incident.** Schedule it; don't
hotfix it at 2am.

## The upgrade
The whole `@nestjs/*` family must move together, or npm hits peer conflicts:

```powershell
cd C:\xampp\htdocs\development\PMS0.3
git checkout -b chore/nest-11        # so you can bail out cleanly

npm install `
  @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 `
  @nestjs/config@^4 @nestjs/typeorm@^11 @nestjs/bullmq@^11 `
  @nestjs/jwt@^11 @nestjs/passport@^11 @nestjs/throttler@^6 `
  @nestjs/cli@^11 @nestjs/schematics@^11 @nestjs/testing@^11

npm test          # 78 unit tests — the safety net
npm run build     # real type-check gate
npm audit --omit=dev
```

Then smoke-test the API: `npm run start:dev`, hit `/api/health/ready`, and log in
once (OTP) to confirm auth + RLS still work.

## Breaking changes to watch for
- **Node ≥ 20 required.** Check `node -v` first.
- **Express 5** (via `@nestjs/platform-express@11`) is the main risk. It changes
  route-path syntax (bare `*` wildcards must be named) and makes `req.query` a
  getter. This codebase uses only plain `:param` routes and never assigns to
  `req.query`, so it *should* pass — but the build/tests are what confirm it.
- `@nestjs/config@4`: `forRoot({ isGlobal: true })` is unchanged.
- `@nestjs/throttler@6` already supports Nest 11 — no change needed.
- Nest 11 adjusts default logger levels; verify your log volume in staging.

## Rollback
```powershell
git checkout -- package.json package-lock.json
npm ci
```

## Note
This upgrade could not be completed from the Cowork sandbox: `npm install` for
~1000 packages is terminated by the sandbox before it finishes. It takes ~2
minutes natively. CI (`.github/workflows/ci.yml`) now runs `npm audit` on every
push, so the result is verified automatically once you push the branch.
