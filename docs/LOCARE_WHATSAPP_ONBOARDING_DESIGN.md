# Locare — WhatsApp-first Tenant Onboarding & Passwordless Delivery

**Status:** Design / proposed
**Owner:** Platform
**Related tasks:** #198–#203
**Supersedes for tenants:** email/SMS OTP via SendGrid + Twilio (#124)

---

## 1. Why

SendGrid and Twilio are not cost-effective at Locare's current scale. Two things
change:

1. **Email is now effectively free** — outbound mail goes through the HostAfrica
   mailbox bundled with our hosting (SMTP via nodemailer), so there is no
   per-message email cost.
2. **SMS is the expensive channel** — Twilio's international SMS rates are the
   cost we want to remove.

At the same time we want a smoother tenant onboarding: when a tenant is approved,
their account should come to life automatically, and the channel they actually
read — WhatsApp — should be primary.

## 2. Constraints (agreed)

| Decision | Choice |
|---|---|
| Primary channel | **WhatsApp** |
| Secondary channel | **Email** (HostAfrica SMTP) |
| Auth model | **Passwordless** (OTP per login, no passwords) |
| Trigger | **Fully automated** on approval — no staff action |
| Provider strategy | **Meta WhatsApp Cloud API direct** (no BSP markup, no Twilio) |

## 3. Overview

Every system message — the login OTP *and* the "your account is ready" welcome —
is delivered through a **channel cascade**: try WhatsApp first, fall back to email
if WhatsApp fails or the tenant has no WhatsApp-capable number. Twilio and SendGrid
leave the default path entirely.

```
approval / lease active ──▶ TENANT_WELCOME ┐
                                           ├──▶ cascade: WhatsApp ──(fail)──▶ Email
tenant taps "log in" ──────▶ OTP code      ┘
```

Login remains passwordless: there is no credential to deliver at approval. The
welcome simply points the tenant to the app; their first login sends an OTP over
the same cascade.

## 4. Architecture

### 4.1 WhatsApp Cloud API channel provider (#198)

A new `WhatsAppCloudProvider` implements the existing `ChannelProvider` interface
for `channel: 'whatsapp'` — the same shape as the SendGrid/SMTP email providers, so
domain code never sees a provider name.

- Transport: Meta Graph API `POST https://graph.facebook.com/v20.0/{PHONE_ID}/messages`, dep-free `fetch`.
- Business-initiated messages **must** use a pre-approved **template** (Meta rule),
  so the provider sends `type: "template"` with the template name + variables:
  - OTP → **authentication** template, one `{{1}}` body variable = the code (plus the required button copy).
  - Welcome → **utility** template, variables = tenant first name + agency name.
- Selected by the notification module only when `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`
  are configured; otherwise the `whatsapp` channel is simply absent and the cascade
  uses email.

### 4.2 Channel cascade (#199)

Replace the single `OTP_CHANNEL` with an ordered list `OTP_CHANNELS` (default
`whatsapp,email`). A small `CascadeDelivery` helper walks the list, sending via the
first configured channel that has a usable destination; on a hard failure it falls
through to the next. Delivery outcome (channel used + provider ref, or error) is
logged so a "didn't arrive" report is diagnosable — same pattern we added to leads.

### 4.3 Passwordless OTP over the cascade

`requestOtp(destination)` already issues a code. The only change is delivery: route
the code through the cascade instead of a fixed email/SMS provider. Destination
resolution: if the identifier is a phone → WhatsApp first; if an email → email; the
cascade fills the gaps.

### 4.4 Automated tenant-welcome on approval (#201)

Tenant membership already flips to **active** on lease signing (#186). We hook that
same transition to enqueue a `TENANT_WELCOME` notification via the cascade (WhatsApp
utility template → email fallback), with a deep link to the tenant app. No staff
action; it fires from the approve→lease-active event.

### 4.5 Tenant phone capture, E.164 (#200)

WhatsApp needs a destination, so the tenant's mobile number must be captured at
application and stored on the user in **E.164** (`+27…`). We add normalisation +
validation at intake and a one-off backfill path for existing tenants. Tenants with
no valid number automatically use the email leg of the cascade.

### 4.6 Remember-this-device (#202)

Passwordless means an OTP per login, and each WhatsApp OTP is a paid message. An
opt-in **trusted-device** session (longer-lived, still instantly revocable and still
subject to the idle model) means returning tenants on a known device don't trigger a
WhatsApp OTP every time — keeping the per-login cost near zero for the common case.

## 5. Configuration (env)

```
# Delivery cascade
OTP_CHANNELS=whatsapp,email          # ordered; falls through left→right

# WhatsApp Cloud API (Meta, direct)
WHATSAPP_TOKEN=                       # permanent access token
WHATSAPP_PHONE_ID=+27749474307                    # sender phone-number ID
WHATSAPP_OTP_TEMPLATE=locare_otp      # approved authentication template name
WHATSAPP_WELCOME_TEMPLATE=locare_welcome  # approved utility template name
WHATSAPP_TEMPLATE_LANG=en

# Email fallback (already configured)
SMTP_HOST=mail.locare.co.za
SMTP_USER=partners@locare.co.za
...
```

Until the WhatsApp templates are approved, leave `WHATSAPP_TOKEN` blank — the
cascade runs **email-only** and nothing breaks.

## 6. Message templates (to submit to Meta)

Templates are created by hand in **WhatsApp Manager → Message Templates**. The
name you give a template is the value that goes in `WHATSAPP_OTP_TEMPLATE` /
`WHATSAPP_WELCOME_TEMPLATE` — they must match exactly, as must the language code.

### 6.1 Authentication (OTP) — name `locare_otp`

Meta does **not** allow custom copy for the *Authentication* category. The body is
fixed to `{{1}} is your verification code.` and you only choose the optional
add-ons. Configure it as:

| Setting | Value |
|---|---|
| Category | Authentication |
| Code delivery | Copy code button *(required — see below)* |
| Security disclaimer | On — "For your security, do not share this code." |
| Expiry warning | On — **5 minutes** |

Which renders as:

> **123456** is your verification code. For your security, do not share this code.
> This code expires in 5 minutes.
> `[Copy code]`

**The copy-code button is mandatory.** `WhatsAppCloudProvider` always appends a
`copy_code` button component for `kind: 'auth'` templates; a template without one
is rejected by the Graph API at send time.

> ⚠ **Keep the expiry warning in sync with `OTP_TTL_SECONDS`.**
> The email OTP text derives its wording from that variable at runtime
> (`OTP_TTL_SECONDS=300` → "expires in 5 minutes"), but the WhatsApp template
> carries a **fixed** number baked in at approval time. Changing the TTL updates
> email automatically and leaves WhatsApp lying to the user until the template is
> re-submitted to Meta.

For reference, the email version reads:

> Your one-time sign-in code is 123456. It expires in 5 minutes. If you didn't
> request it, ignore this message.

### 6.2 Utility (welcome) — name `locare_welcome`

Free-form copy is allowed in the *Utility* category:

> *Hi {{1}}, your {{2}} tenant account is ready. Open the app to view your lease,
> pay rent and log maintenance: https://app.locare.co.za*

Variable order is set by the caller in `lease-agreement.service.ts` —
`{{1}}` = tenant first name, `{{2}}` = agency name. Do not swap them.

Both templates must be approved before automated sends work (Authentication is
usually near-instant; Utility can take a few hours to ~1 business day).

## 7. Costs

> Meta reviews rates quarterly (1 Jan / 1 Apr / 1 Jul / 1 Oct) and prices are
> per-message since 1 July 2025. Figures below are planning estimates at **≈ R18/$1**
> and **must be confirmed on Meta's official rate card** before budgeting. They are
> based on 2024–2026 published South-Africa rates.

### 7.1 Fixed / setup costs

| Item | Cost |
|---|---|
| Meta WhatsApp Cloud API platform fee | **R0** (direct; you pay per message only) |
| Business verification (Meta Business) | **R0** |
| Template creation & approval | **R0** |
| Dedicated sender number | Cost of one phone number you own that is **not** on personal WhatsApp (a spare SIM / VoIP number) — typically once-off / negligible |
| BSP subscription | **R0** — avoided by going direct (a BSP would add markup; this is why we skip it) |
| Email (HostAfrica SMTP) | **R0** — bundled with hosting |

### 7.2 Per-message cost (the only variable cost)

| Message type | Category | Approx. rate | Notes |
|---|---|---|---|
| Login OTP | Authentication (domestic) | ~$0.008–0.014 → **≈ R0.14–0.25** | Requires a WhatsApp Business Account **registered in South Africa** to get the domestic rate |
| Login OTP (int'l) | Authentication-International | ~$0.028 → **≈ R0.50** | Applies if the WABA is registered *outside* SA — avoid by registering in SA |
| Welcome | Utility | low (few cents); **free** inside an open 24-h service window¹ | Business-initiated welcome is normally charged at the (low) utility rate |
| Tenant's replies | Service | **free** within the 24-h window¹ | — |
| Email fallback | — | **R0** | HostAfrica SMTP |

¹ From **1 October 2026** Meta begins charging service messages and utility
messages sent inside the 24-h window (service at utility/auth rates). Budget for
utility/service to become chargeable after that date.

### 7.3 Worked example (planning)

Assumptions: 200 active tenants; with remember-this-device, returning tenants
trigger an OTP ~2×/month on average; 200 new tenants onboarded per year (1 welcome
each); SA-registered WABA (domestic auth rate ≈ R0.20).

| Line | Volume / yr | Unit | Annual |
|---|---|---|---|
| Login OTPs | 200 × 2 × 12 = 4,800 | R0.20 | **≈ R960** |
| Welcomes | 200 | ~R0.20 | **≈ R40** |
| Email fallbacks | any overflow | R0 | R0 |
| **Total variable** | | | **≈ R1,000 / year** |

Sensitivity: at the international auth rate (~R0.50) the OTP line ≈ R2,400/yr; the
biggest lever is (a) registering the WABA in SA for the domestic rate and (b)
remember-this-device to suppress repeat OTPs.

### 7.4 Comparison to the channels we're replacing

| Channel | Approx. per-message | Deliverability / read rate |
|---|---|---|
| **WhatsApp auth (SA domestic)** | **≈ R0.14–0.25** | Very high; ~98% read, in-app |
| Local bulk SMS (SMSPortal/BulkSMS/SMSMessenger) | R0.12–0.22 | High delivery, lower engagement |
| Twilio SMS to SA | Materially higher (international carrier fees) | The cost we're removing |
| Email (HostAfrica) | R0 | Free, but slower/lower open rate — fine as fallback |

Net: WhatsApp domestic auth is comparable to the *cheapest* local SMS on price while
far ahead on engagement, and email carries the rest for free. Twilio is dropped.

## 8. Meta setup checklist (prerequisite — your side)

1. Create/confirm a **Meta Business** account and complete **business verification**.
2. Create a **WhatsApp Business Account (WABA)** — **register it in South Africa** for domestic auth rates.
3. Add a **dedicated sender phone number** (not on personal WhatsApp) and verify it.
4. Generate a **permanent access token** (system-user token) → `WHATSAPP_TOKEN`; note the **phone-number ID** → `WHATSAPP_PHONE_ID`.
5. Create and submit the two templates (§6); wait for approval.
6. Set the env vars and deploy `api`. Until then, the cascade is email-only.

## 9. Security & compliance

- OTP codes are sent via Meta's authentication template with the one-time-code
  button; codes remain server-generated, single-use, short-TTL, and rate-limited
  exactly as today.
- **POPIA**: tenant phone numbers are personal data — captured with consent at
  application, stored E.164, and used only for account/service messages (no
  marketing templates). WhatsApp opt-out is honoured.
- Template rule: only approved templates for business-initiated messages; free-form
  text only inside a customer-opened 24-h window.

## 10. Rollout / phasing

1. Ship the provider + cascade + phone capture + welcome (**email-only** while
   `WHATSAPP_TOKEN` is blank) — safe to deploy immediately, zero behaviour change.
2. Complete the Meta setup (§8) and get templates approved.
3. Set the WhatsApp env vars → WhatsApp becomes primary automatically.
4. Add remember-this-device to suppress repeat OTP cost.
5. Retire Twilio from prod config once WhatsApp is confirmed working.

## 11. Open questions / risks

- **WABA jurisdiction**: registering in SA is worth it for the domestic auth rate —
  confirm the business entity supports it.
- **Number choice**: the sender number can't be a personal-WhatsApp number; decide
  on a spare SIM vs a VoIP number.
- **Oct 2026 pricing change**: utility/service inside the window becomes chargeable —
  revisit the welcome-message cost line after that date.
- **Non-smartphone tenants**: the email leg covers them; a small share may need
  staff-mediated onboarding (out of scope here).
