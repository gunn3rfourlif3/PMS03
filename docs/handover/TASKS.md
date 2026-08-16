# Locare — task history

Every task tracked across the project, in order. Numbering gaps (#125, #134) are
tasks that were deleted as stale rather than completed.

**219 completed · 4 outstanding**

---

## Spec and architecture (#1–#6)

- [x] #1 Write evaluation of original spec
- [x] #2 Document gaps and missing features
- [x] #3 Critique technical architecture
- [x] #4 Design data model / entities
- [x] #5 Build MVP roadmap and phasing
- [x] #6 Assemble and write improved spec file

## Foundation — scaffold, tenancy, database (#7–#18)

- [x] #7 Scaffold repo skeleton + config
- [x] #8 Build tenancy/common layer
- [x] #9 Scaffold domain modules
- [x] #10 Build provider + ZA policy layer
- [x] #11 Add docs + verify build
- [x] #12 Add DB/auth dependencies
- [x] #13 TypeORM data source + database module
- [x] #14 RLS tenant-scoped transaction layer
- [x] #15 Initial migration with RLS policies
- [x] #16 Auth module (JWT + OTP + guards)
- [x] #17 Wire modules + verify
- [x] #18 Add BullMQ deps + queue module

## Ledger, billing and payments (#19–#27)

- [x] #19 Double-entry posting engine
- [x] #20 Invoice generation + ledger posting
- [x] #21 Recurring billing job
- [x] #22 Migration + tests + verify
- [x] #23 Correct immutability model
- [x] #24 Payment entity + collection via Stitch
- [x] #25 Payment confirmation + ledger allocation
- [x] #26 Dunning / late-fee job
- [x] #27 Migration, wiring, verify

## Owners, deposits, payouts (#28–#31)

- [x] #28 Owner entity + module
- [x] #29 Deposit trust flow
- [x] #30 Owner statements + split payouts
- [x] #31 Accounts, migration, wiring, verify

## Notifications, documents, expenses (#32–#42)

- [x] #32 Notification provider abstraction
- [x] #33 Templates + preferences (pure)
- [x] #34 Notification entities + service + processor
- [x] #35 Wire billing events + migration + verify
- [x] #36 Storage + e-sign provider abstractions
- [x] #37 Document + signature entities + pure helpers
- [x] #38 Documents + e-sign services + controller
- [x] #39 Migration, wiring, verify
- [x] #40 Expense entity + service + accounts
- [x] #41 Fold expenses into owner statements
- [x] #42 Migration, wiring, verify

## Listings and applications (#43–#48)

- [x] #43 Listing/Application entities + pure helpers
- [x] #44 Supporting service methods
- [x] #45 Listings + Applications services + approve→lease
- [x] #46 Controller, migration, wiring, verify
- [x] #47 Verify ticketing module end-to-end
- [x] #48 Run and verify landlord app (mobile-landlord)

## Branding and white-label (#49–#57)

- [x] #49 Backend: vendor branding + public /branding endpoint
- [x] #50 Shared theme system for the apps
- [x] #51 Polish landlord app to mockup standard
- [x] #52 Polish tenant app to mockup standard
- [x] #53 Polish web back-office to mockup standard
- [x] #54 Verify theming + brand swap end-to-end
- [x] #55 Backend: authed get/update vendor branding
- [x] #56 Web: Branding settings page
- [x] #57 Verify branding settings end-to-end

## Feature UIs across web and mobile (#58–#67)

- [x] #58 Backend: list work-orders + owner statements GETs
- [x] #59 Landlord: Tickets management tab
- [x] #60 Tenant: Maintenance filing screen
- [x] #61 Web: Owner statements history + payout
- [x] #62 Typecheck + verify feature UIs
- [x] #63 Backend: GET /me/profile
- [x] #64 Tenant app: bottom nav + mockup home redesign
- [x] #65 Landlord app: tab icons + dashboard polish
- [x] #66 Typecheck mobile redesign
- [x] #67 Write PowerShell API test scripts

## Design system rebuild (#68–#71)

- [x] #68 Web: Tailwind + glass foundation
- [x] #69 Web: glass responsive shell + nav
- [x] #70 Web: rebuild all pages premium
- [x] #71 Mobile: NativeWind + glassmorphism (both apps)

## Reporting, documents, inspections, API keys (#72–#81)

- [x] #72 Backend: income statement report endpoint
- [x] #73 Web: Reports page + CSV exports
- [x] #74 Web: Documents & e-sign UI
- [x] #75 Web: Inspections UI
- [x] #76 Web: API keys (developer) UI
- [x] #77 In-app notifications feed
- [x] #78 Lease renewals + escalation
- [x] #79 Owner banking details + service providers
- [x] #80 Property/unit CRUD (backend + web)
- [x] #81 Wire work orders to service providers

## Messaging (#82–#87)

- [x] #82 Backend: messaging entities + migration
- [x] #83 Backend: messaging service + controller
- [x] #84 Web: Messages inbox page
- [x] #85 Landlord app: Messages screen
- [x] #86 Tenant app: Messages screen
- [x] #87 Seed messages + typecheck all

## Owner portal (#88–#90)

- [x] #88 Backend: owner portal API
- [x] #89 Web: owner portal pages + role routing
- [x] #90 Seed owner login + typecheck

## Security, PII, real providers (#91–#99)

- [x] #91 PII crypto util + transformer
- [x] #92 Encrypt owner banking at rest + mask
- [x] #93 Real payment provider (Paystack HTTP)
- [x] #94 Real notification providers (email/SMS)
- [x] #95 Real e-sign provider (HTTP)
- [x] #96 Observability: health + logging + errors
- [x] #97 Real-time messaging (SSE)
- [x] #98 Tests for new code
- [x] #99 CI/CD pipelines + Docker

## Payment gateways (#100–#103)

- [x] #100 PayFast provider (redirect + signature)
- [x] #101 Yoco + Peach providers (checkout)
- [x] #102 Wire gateways: registry + payout split
- [x] #103 Tests + typecheck gateways

## Hardening (#104–#107)

- [x] #104 Fix OTP brute-force (attempt lockout)
- [x] #105 Fail-fast production env validation
- [x] #106 Harden HTTP: CORS allowlist + security headers
- [x] #107 Mobile API base from env

## Manuals and deployment (#108–#124)

- [x] #108 Build SVG screenshot generator
- [x] #109 Write Staff (web) manual
- [x] #110 Write Tenant app manual
- [x] #111 Write Landlord app manual
- [x] #112 Wire OTP delivery via email/SMS
- [x] #113 Deploy assets (Caddy, compose, env, scripts)
- [x] #114 Contabo deployment runbook
- [x] #115 iKhokha payment provider
- [x] #116 Stub other gateways behind LIVE flags
- [x] #117 iKhokha env, docs, tests
- [x] #118 Add web Dockerfiles for both mobile apps
- [x] #119 Add Caddy routes + compose services
- [x] #120 Verify Expo web export builds
- [x] #121 Write DNS + deploy instructions
- [x] #122 Wire Dantalan branding per-subdomain
- [x] #123 Build Add-tenant feature
- [x] #124 Email + SMS OTP auth (no WhatsApp)

## Public rentals site and agents (#126–#137)

- [ ] **#126 Verify first live iKhokha payment end-to-end** ← outstanding
- [x] #127 Enable iKhokha inbound callback signature verification
- [x] #128 Design + build agents/commission feature
- [x] #129 Public rentals: migration (details + SECURITY DEFINER fns)
- [x] #130 Public rentals: backend endpoints
- [x] #131 Public rentals: web pages (browse + detail + apply)
- [x] #132 Public rentals: back-office copy-link + application details view
- [x] #133 Public rentals: Caddy route + CORS + DNS/deploy
- [x] #135 Marketing site: backend lead capture
- [x] #136 Marketing site: premium minimalist landing page
- [x] #137 Marketing site: Docker + Caddy + CORS + deploy

## Media, proof of payment, e-sign (#138–#151)

- [x] #138 Add picture upload for listings and inspections
- [x] #139 Media: real disk storage (upload + serve)
- [x] #140 Listing photos: backend + back-office + public render
- [x] #141 Inspection photos: per-item upload + render
- [x] #142 Tenant proof-of-payment upload
- [x] #143 Prevent duplicate listings for the same unit/property
- [x] #144 Proof of payment: backend (entity, module, reconcile)
- [x] #145 Proof of payment: staff review queue (web)
- [x] #146 Proof of payment: tenant upload (mobile app)
- [x] #147 Lease e-sign: backend (generate + sign flow)
- [x] #148 Lease e-sign: public signing page (web)
- [x] #149 Smart Lease & Document Parsing Agent (AI)
- [x] #150 Lease parsing MVP: provider + backend
- [x] #151 Lease parsing MVP: split-screen verify (web)
- [ ] **#152 Test LLM lease parser end-to-end (after adding Anthropic key)** ← outstanding

## Agents, sessions, dashboard (#153–#176)

- [x] #153 Agents: backend (entities, module, commissions)
- [x] #154 Agents: back-office UI
- [x] #155 Web back-office idle auto-logout
- [x] #156 Tenant app idle auto-logout
- [x] #157 Landlord app idle auto-logout
- [x] #158 Typecheck all three apps
- [x] #159 Server: configurable idle window + refresh endpoint
- [x] #160 Clients: configurable timeout + refresh-on-activity
- [x] #161 Typecheck backend + all clients
- [x] #162 True instant session revocation (server-side)
- [x] #163 Rebuild back-office Dashboard as vibrant bento
- [x] #164 Add reusable bento tile components + tokens
- [x] #165 Typecheck web-admin after Dashboard rebuild
- [x] #166 Foundation restyle: calm background + solid cards
- [x] #167 Install recharts + rebuild Reports with charts
- [x] #168 Restyle Payments page in new style
- [x] #169 Listings: add deposit + admin fee columns
- [x] #170 Move-in invoice renderer + email on approval
- [x] #171 Web: deposit + admin fee on listing form
- [x] #172 Typecheck + test move-in invoice
- [x] #173 Add square meterage to units
- [x] #174 Listing form: pull unit details + description
- [x] #175 Typecheck backend + web (units/listings)
- [x] #176 Align tenant + landlord apps to back-office look

## Partner programme and SaaS billing (#177–#183)

- [x] #177 Partner Phase 0: vendor subscriptions + MRR
- [x] #178 Partner Phase 1: partners, roles, portal, pipeline, leaderboard
- [x] #179 Partner Phase 2: commission accrual + payouts
- [x] #180 Partner Phase 3: referral self-signup + real billing
- [x] #181 Recurring SaaS billing: collect subscription fees from agencies
- [x] #182 Subscription webhook auto-reconcile
- [x] #183 Fix idle logout + add warning modal (web)

## Membership gating and impersonation (#184–#192)

- [x] #184 Migration: membership status + auth filter
- [x] #185 Membership entity + identity service status
- [x] #186 Grant access on lease signing
- [x] #187 Typecheck backend
- [x] #188 Impersonation: backend core (endpoints + act claim)
- [x] #189 Impersonation: audit trail (migration + logging)
- [x] #190 Impersonation: web enter flow (agencies list)
- [x] #191 Impersonation: banner + exit (web)
- [x] #192 Impersonation: admin audit view + verify

## Google login and WhatsApp onboarding (#193–#205)

- [x] #193 Fix partner registration email delivery
- [x] #194 Google login: backend auth + linking
- [x] #195 Google login: central callback + return-to-origin
- [x] #196 Google login: web button + return page
- [x] #197 Google login: security, consent + verify/deploy
- [x] #198 WhatsApp Cloud API channel provider
- [x] #199 Channel cascade: WhatsApp primary, email fallback
- [x] #200 Capture tenant phone (E.164) for WhatsApp
- [x] #201 Automated tenant-welcome on approval
- [x] #202 Remember-this-device trusted session
- [x] #203 WhatsApp/Meta setup + templates docs
- [ ] **#204 Set up Meta WhatsApp Business account** ← outstanding, needs Arthur
- [x] #205 Wire remember-device into tenant + landlord apps

## Partner KYC/KYB vetting (#206–#212)

- [x] #206 Partner KYC/KYB: migration + entities
- [x] #207 Partner KYC/KYB: public submit + document upload
- [x] #208 Partner KYC/KYB: admin review + approve/reject
- [x] #209 Partner KYC/KYB: KycProvider interface (provider-ready)
- [x] #210 Partner KYC/KYB: public application form (web)
- [x] #211 Partner KYC/KYB: admin review UI (web)
- [x] #212 Partner KYC/KYB: notifications + tests + verify

## Performance, two-stage signup, growth (#213–#223)

- [x] #213 Optimize site load speed
- [x] #214 Partner apply: two-stage backend (lead + KYC resume)
- [x] #215 Partner apply: 48h reminder job
- [x] #216 Partner apply: split public web form
- [x] #217 Partner apply: admin lead visibility + verify
- [x] #218 Update CV with Locare flagship project
- [x] #219 SEO foundations for locare.co.za
- [x] #220 Build free property calculators
- [x] #221 Powered-by Locare flywheel on rentals sites
- [x] #222 Weekly content agent (draft for review)
- [x] #223 Locare video production pack

---

## Still open

| # | Task | Blocked on |
|---|---|---|
| 126 | Verify first live iKhokha payment end-to-end | A real transaction; then flip `IKHOKHA_VERIFY_CALLBACK` monitor → enforce |
| 152 | Test LLM lease parser end-to-end | `ANTHROPIC_API_KEY` not set |
| 204 | Set up Meta WhatsApp Business account | Arthur — Meta business verification + template approval |

Not tracked as numbered tasks but outstanding (see `CLAUDE.md`): registered
entity details on the legal pages, Google OAuth brand verification, error
tracking and uptime monitoring, backup cron confirmation and a restore test.
