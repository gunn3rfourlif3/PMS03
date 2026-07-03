# PMS Landlord App (Expo / React Native)

Pocket analytics + on-the-go approvals for property managers.

## Setup
```bash
cd mobile-landlord
npm install
npm start          # press w for web, or i / a / Expo Go
```
Set `API_BASE` in `src/config.ts` (localhost for web/iOS-sim; LAN IP for a device).
The PMS API must be running with the back-office endpoints patch applied
(Applications tab needs GET /listings/applications).

## Use
Sign in as a manager: `owner@demo.test` (OTP prints to the API server console).
- Dashboard: active leases, collected, collection rate, arrears, portfolio.
- Approvals: screen (with sensible defaults), approve, or reject applications.
