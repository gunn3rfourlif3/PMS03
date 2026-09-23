# PMS 0.3 — User Manuals

Four role-based user manuals, one per audience. The three product manuals
include screenshots rendered in the platform's real design; the partner manual
is text-only, because the partner portal has no rendered assets yet.

| Manual | Audience | Surface |
| --- | --- | --- |
| [Staff (Back-Office) Manual](Staff-Web-Manual.md) | Agency owners & property managers | Web console + Owner Portal |
| [Tenant App Manual](Tenant-App-Manual.md) | Residents / tenants | Mobile app |
| [Landlord App Manual](Landlord-App-Manual.md) | Agency staff on the go | Mobile app |
| [Partner Manual](Partner-Manual.md) | Referral partners & resellers | Partner portal |

## About the screenshots
The screenshots in `assets/` are faithful UI mockups generated to the platform's
real design system — brand green `#0F6E56`, gold accent, Sora headings, Plus
Jakarta body text, and the glassmorphism card style — so they match the running
apps section-for-section. They use the seeded **demo brand**; a vendor's own logo
and colours replace them via **Settings → Branding**.

To swap these for live captures once the apps are running, replace the matching
file in `assets/` (keep the filename) and the manuals pick it up automatically.

## See also
- `RUN.md` — run the whole stack locally
- `DEPLOY.md` — CI/CD, Docker, health checks, production env
- `UPGRADE.md` — dependency upgrade runbook
