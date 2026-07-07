# API test scripts

PowerShell scripts that exercise the exact endpoints the tenant app, landlord
app, and web back-office call — a fast way to smoke-test the backend the
frontends depend on (login, payments, maintenance, owner statements, branding)
without clicking through the UI.

## Prerequisites

- The API running locally on `http://localhost:3000` (`npm run dev`).
- Postgres + Redis up, migrations run, seed applied.
- Windows PowerShell 5.1 or PowerShell 7.

To point at another host: `\$env:PMS_API = 'http://your-host:3000/api'`

## Login (passwordless OTP)

There's no password — the API emails/prints a one-time code. In dev the code is
printed to the **API server console**. The scripts request the code, then prompt
you to paste it. The resulting JWT is cached under `.tokens/` and reused by the
other scripts until it expires (default 1h; raise `JWT_EXPIRES_IN` in `.env` for
longer dev sessions).

```powershell
cd scripts\api-tests
./login.ps1 -Email owner@demo.test -Role owner
./login.ps1 -Email thabo@demo.test -Role tenant
```

## Run the journeys

```powershell
./test-branding.ps1    # public /branding/:slug + owner self-service edit (no login needed for the public part)
./test-tenant.ps1      # profile, invoices, lease, file a ticket, pay rent   (thabo@demo.test)
./test-landlord.ps1    # dashboard, assign/complete a ticket, owner statement (owner@demo.test)
./test-all.ps1         # all of the above in sequence
```

Each step prints `[PASS]`/`[FAIL]`; add nothing — results stream as you go.

Tip: run `./test-tenant.ps1` before `./test-landlord.ps1` so there's a freshly
filed **open** ticket for the landlord script to assign → start → complete.

## If you see 401 Unauthorized

The cached token expired. Re-run the matching `login.ps1` (or just delete
`.tokens/` and re-run any script — it will prompt for a fresh code).

## Notes

- These hit the real dev database, so they create real rows (a maintenance
  ticket, a payment attempt, an owner statement). That's intentional for a smoke
  test; re-running is safe (payment initiation is idempotent per invoice).
- The `demo` vendor is the seeded one with data. `rivonia` exists for branding
  only (owner@rivonia.test) and has no leases/tickets.
