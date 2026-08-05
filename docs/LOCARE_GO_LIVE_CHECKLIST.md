# Locare — Go-Live Checklist (remaining backlog)

Four items remain, all requiring your action (external accounts / DNS / live money).
Suggested order: **1) Email → 2) Lease AI → 3) WhatsApp → 4) iKhokha**, easiest to
hardest. Each section has: what you need, the steps, and how to verify.

**Editing env + deploying (used throughout).** All secrets live in
`deploy/.env.prod` on the VPS. After editing it, rebuild the API:

```bash
cd ~/PMS03
git pull
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml up -d --build api
```

Handy log check (replace the grep as noted per section):

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml logs --tail=50 api | grep -iE "channels|lead notify|extractor|IK-SIGN"
```

---

## 1. #193 — Partner registration email (HostAfrica SMTP)

**Blocked on:** DNS propagation of the MX / `mail` records you fixed at HostAfrica.

**Step 1 — confirm DNS has propagated** (from your PC):

```bash
nslookup -type=mx locare.co.za
nslookup mail.locare.co.za
```

- MX must return **`mail.locare.co.za`**.
- `mail.locare.co.za` must resolve to the HostAfrica mail IP (the `169.239.x.x`
  range), **not** `169.58.46.223` (your VPS). If it still shows the VPS, DNS hasn't
  finished — wait and re-check.

**Step 2 — set SMTP env** in `deploy/.env.prod`:

```
SMTP_HOST=mail.locare.co.za
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=partners@locare.co.za
SMTP_PASS=<the mailbox password>
SMTP_FROM=partners@locare.co.za
```

(If HostAfrica prefers 587, use `SMTP_PORT=587` and leave `SMTP_SECURE` blank.)

**Step 3 — deploy** the API (command at top).

**Step 4 — verify.** In the startup log you should see:

```
channels — email:SmtpEmailProvider ... whatsapp:off
```

Then submit a test **Register as a partner** form on the site and check:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml logs --tail=30 api | grep -i "lead notify"
```

`lead notify sent → partners@locare.co.za` = delivered. Confirm it lands in the
HostAfrica inbox. This also makes **email OTP login** work.

**If it fails:** `no email channel configured` → `SMTP_HOST` not set; a send error
→ wrong password/port; `sent` but not in inbox → DNS/MX still pointing at the VPS.

---

## 2. #152 — AI lease parser (Anthropic)

**Blocked on:** an Anthropic API key.

**Step 1 — get a key.** Sign up at console.anthropic.com, add billing, create an
API key (starts `sk-ant-...`).

**Step 2 — set env** in `deploy/.env.prod`:

```
DOCUMENT_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
DOCUMENT_AI_MODEL=            # blank = claude-3-5-sonnet-latest
```

**Step 3 — deploy** the API.

**Step 4 — verify.** Startup log should read:

```
DocumentAI  extractor: anthropic
```

Then in the back-office (`app.locare.co.za`) go to **Import lease**, upload a
**digital (text) PDF** lease — not a scanned image (OCR isn't in this version).
The split-screen review should show extracted tenant, rent, dates, deposit,
escalation and any flagged clauses, each editable before you confirm.

**If it fails:** "rejected the API key" → wrong/rotated key; "scanned image" message
→ upload a text PDF; timeouts auto-retry twice, then surface a clear message.

---

## 3. #204 — WhatsApp Business (Meta Cloud API)

**Blocked on:** Meta account setup + template approval (a few hours to ~1 day).
Until done, the cascade runs **email-only** — nothing breaks.

**Step 1 — Meta Business + verification.** At business.facebook.com create/confirm
a Meta Business account and complete **business verification**.

**Step 2 — create a WhatsApp Business Account (WABA)** — **register it in South
Africa** so you get the cheaper domestic authentication rate.

**Step 3 — add a sender number.** A phone number **not** currently on personal
WhatsApp (a spare SIM or VoIP number). Verify it in WhatsApp Manager.

**Step 4 — get credentials:**
- A **permanent access token** (create a System User in Business Settings → assign
  the WABA → generate a token that doesn't expire) → `WHATSAPP_TOKEN`.
- The **phone-number ID** (WhatsApp Manager → API setup) → `WHATSAPP_PHONE_ID`.

**Step 5 — create + submit two message templates** (WhatsApp Manager → Message
Templates), then wait for approval:

- **Authentication** template named `locare_otp`, body: *"Your Locare verification
  code is {{1}}. It expires in 10 minutes."* with the one-time-code **Copy code**
  button.
- **Utility** template named `locare_welcome`, body: *"Hi {{1}}, your {{2}} tenant
  account is ready. Open the app to view your lease, pay rent and log maintenance:
  https://app.locare.co.za"*

**Step 6 — set env** in `deploy/.env.prod`:

```
WHATSAPP_TOKEN=<permanent token>
WHATSAPP_PHONE_ID=<phone number id>
WHATSAPP_OTP_TEMPLATE=locare_otp
WHATSAPP_WELCOME_TEMPLATE=locare_welcome
WHATSAPP_TEMPLATE_LANG=en
OTP_CHANNELS=whatsapp,email
```

**Step 7 — deploy** the API.

**Step 8 — verify.** Startup log should now read:

```
channels — email:SmtpEmailProvider ... whatsapp:WhatsAppCloudProvider
```

Log in with a phone number (or sign a test lease) — the OTP / welcome should arrive
on WhatsApp; if WhatsApp fails it falls back to email automatically.

**Cost note:** you pay Meta per message (~R0.14–0.25 per SA domestic auth message);
see `docs/LOCARE_WHATSAPP_ONBOARDING_DESIGN.md` §7 for the full breakdown.

---

## 4. #126 + #127 — First live iKhokha payment & signature enforcement

**Blocked on:** a real (small) live payment.

**Step 1 — confirm live creds** in `deploy/.env.prod`:

```
PAYMENT_PROVIDER=ikhokha
IKHOKHA_MODE=live
IKHOKHA_APP_ID=...
IKHOKHA_APP_SECRET=...
IKHOKHA_ENTITY_ID=...
IKHOKHA_CALLBACK_URL=https://api.dantalan.co.za/api/payments/webhook/ikhokha
IKHOKHA_VERIFY_CALLBACK=monitor
```

(Set `IKHOKHA_VERIFY_CALLBACK=monitor` first — it verifies the signature and logs
the result but still processes, so a real payment can't be lost while you confirm
the scheme.)

**Step 2 — deploy** the API.

**Step 3 — make a small real payment.** As a tenant (in the tenant app or the pay
link), pay a small invoice with a real card/EFT through the iKhokha checkout.

**Step 4 — verify the callback** landed and reconciled:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml logs --tail=60 api | grep -iE "IK-SIGN|settled|reconcile"
```

- `IK-SIGN verified (monitor)` = the signature scheme matches. (An `IK-SIGN
  mismatch` warning means it doesn't — the payment still processes; send me the log
  and I'll adjust the signing.)
- The invoice should flip to **paid** in the back office (and subscription invoices
  auto-reconcile via #182).

**Step 5 — enforce.** Once you've seen clean `IK-SIGN verified` lines on real
callbacks, set `IKHOKHA_VERIFY_CALLBACK=enforce` and redeploy. Forged/unsigned
callbacks are now rejected with a 401.

---

## Done =
- [ ] #193 partner email delivering
- [ ] #152 lease AI extracting from a real PDF
- [ ] #204 WhatsApp templates approved + OTP/welcome arriving on WhatsApp
- [ ] #126 first live iKhokha payment reconciled
- [ ] #127 `IKHOKHA_VERIFY_CALLBACK=enforce` after clean monitor logs
