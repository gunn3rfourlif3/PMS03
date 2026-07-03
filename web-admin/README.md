# PMS Web Back-office (Next.js)

Manager console for the PMS platform: OTP login, portfolio dashboard (rent roll,
arrears aging, collection, run-billing), and listings management. Talks to the
PMS API and is RLS-scoped to the signed-in vendor.

## Setup
```bash
cd web-admin
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE defaults to http://localhost:3000/api
npm run dev                        # http://localhost:3001
```
The API (port 3000) must be running, with CORS enabled (already is).

## Use
Sign in as a manager: `owner@demo.test`. The OTP prints to the API server
console. Dashboard and Listings load live, vendor-scoped data.

## Notes
- Runs on port 3001 so it doesn't clash with the API (3000).
- Auth token is kept in localStorage and sent as `Authorization: Bearer`.
- Owners statements + the applicant pipeline need two small backend GET
  endpoints (list owners, list applications) — a follow-up.
