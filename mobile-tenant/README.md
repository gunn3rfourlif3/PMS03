# PMS Tenant App (Expo / React Native)

Mobile-first tenant app for the PMS platform: passwordless OTP login, rent
dashboard, one-tap pay (Stitch), and lease view. White-label via `src/config.ts`.

## Prerequisites
- Node 20+, and the PMS API running (`npm run start:dev` in the backend, on :3000).
- Expo tooling: no global install needed — `npx expo` works. For a device, install
  **Expo Go** from the app store.

## Setup
```bash
cd mobile-tenant
npm install
```

Point the app at your API in `src/config.ts` (`API_BASE`):
- iOS simulator / web: `http://localhost:3000/api`
- Android emulator:    `http://10.0.2.2:3000/api`
- Physical device:     `http://<your-computer-LAN-IP>:3000/api` (same Wi-Fi)

## Run
```bash
npm start          # then press i (iOS), a (Android), or w (web)
```

## Try it
1. Log in as the seeded tenant: `thabo@demo.test`. The OTP prints to the **API
   server console** (dev `OTP_CHANNEL=console`); enter it in the app.
2. The dashboard shows invoices from `GET /me/invoices`; "Pay rent" calls
   `POST /payments/invoices/:id/initiate` and opens the pay-by-bank URL.
3. To see a *payable* invoice, have a manager generate the next period
   (`POST /api/billing/run` for e.g. `2026-09`) — otherwise everything shows paid.

## Structure
- `src/config.ts` — API base + white-label brand (per-vendor in production).
- `src/api.ts` — fetch client + secure token storage (expo-secure-store).
- `src/auth-context.ts` — sign-in/out state that switches the navigator.
- `src/screens/` — Login (OTP), Dashboard (rent + invoices + pay), Lease.

## Notes
- Auth is the same JWT the backend issues; the token is kept in the device
  secure store and sent as `Authorization: Bearer`.
- "Log ticket" is intentionally omitted — the maintenance module is a backend
  stub (no create endpoint yet); wire it when that lands.
