# Locare — Google (Social) Login

Status: **Draft for build.** Owner: Arthur. Last updated: 2026-07-31.

Add "Continue with Google" as an **additional** sign-in option alongside the
existing passwordless OTP — without breaking the multi-tenant, white-label,
custom-domain model, and without excluding phone-first tenants.

---

## 1. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Replace OTP? | **No — additive.** Email + **SMS** OTP stay (SMS matters for tenants). Google is an extra path. |
| 2 | Where offered | Everywhere, but the value is B2B: agency signup, staff, platform admin. Tenants can use it, but OTP (esp. SMS) remains their primary path. |
| 3 | OAuth flow | **Authorization Code** (server-side code exchange), verified ID token. |
| 4 | Redirect model | **One central callback** on `auth.locare.co.za`; return to the originating host via signed `state`. Solves custom-domain + wildcard redirect-URI pain. |
| 5 | Identity linking | Link by **Google-verified email**; store the Google `sub`. Once linked, only that Google account can Google-login that user. |
| 6 | Token issuance | After verifying Google, mint **our own JWT** through the exact same path as OTP (membership resolution, `jti` session, pending-membership handling). |
| 7 | Provider scope | Google only for v1. Microsoft/Apple noted as future. |

---

## 2. Why a central callback

Google OAuth requires each `redirect_uri` to be pre-registered. With agencies on
their own domains (`dantalan.co.za`) and a future `*.locare.co.za` wildcard,
registering every host is impractical. Instead:

- **One** registered redirect URI: `https://auth.locare.co.za/api/auth/google/callback`.
- The "Continue with Google" button (on any host) sends the user to Google with a
  signed `state` that encodes **the origin host to return to** + a CSRF nonce.
- After the callback verifies Google and issues our JWT, it redirects back to the
  origin host with a **one-time code** (short-TTL, single-use) that the origin
  page exchanges for the token — so the token itself never rides in a URL.

---

## 3. Flow

```
[any host] "Continue with Google"
   → GET auth.locare.co.za/api/auth/google/start?origin=<host>
   → 302 to Google authorize (client_id, scope=openid email profile,
        redirect_uri=auth.locare.co.za/.../callback, state=sign({origin,nonce}))
[Google consent]
   → GET auth.locare.co.za/api/auth/google/callback?code&state
   → verify state; exchange code; verify ID token (iss, aud=client_id, exp,
        email_verified=true); read {email, sub}
   → find-or-link user (§4); resolve memberships; mint JWT + jti session
   → 302 to https://<origin>/auth/google/return?otc=<one-time-code>
[origin page] exchanges otc → { accessToken }; store; router → homeForRole()
```

Pending-membership case (approved tenant who hasn't signed) is handled exactly as
in OTP: the same "please sign your lease first" response applies.

---

## 4. Account linking rules

`users` gains `google_sub text unique null`.

On a verified Google identity `{ email, sub }`:

1. **Existing user with `google_sub = sub`** → sign in.
2. **Existing user by `email`, `google_sub` empty** → link (set `google_sub = sub`), sign in.
3. **Existing user by `email`, `google_sub` set and ≠ sub** → **reject** (email
   belongs to a different Google account; possible takeover attempt).
4. **No user** → create `{ email, google_sub: sub }`, sign in (no membership yet →
   lands on the `/no-access` empty state until an agency links them).

`email_verified` from Google is mandatory; unverified Google emails are refused.

---

## 5. Security & privacy

- Verify the ID token server-side: signature (Google JWKS), `iss` in
  `accounts.google.com` / `https://accounts.google.com`, `aud == GOOGLE_CLIENT_ID`,
  `exp` valid, `email_verified == true`.
- Signed, single-use, short-TTL `state` and one-time return code (both in Redis).
- Our JWT + revocable `jti` session are unchanged — Google only authenticates;
  authorization/roles/RLS are ours.
- POPIA: a one-line consent ("you agree to share your Google email with {brand}")
  and a linked privacy policy; Google consent-screen verification before launch.
- Rate-limit `start`/`callback`; never trust client-supplied email — only the
  verified ID-token email.

---

## 6. Config / infra

- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_ENABLED=true`,
  `AUTH_BASE=https://api.locare.co.za`.
- **Built to reuse the existing `api.locare.co.za`** as the single fixed redirect
  host — no new `auth.` subdomain/DNS/Caddy needed.
- Google Cloud: OAuth 2.0 client, authorised redirect URI
  `https://api.locare.co.za/api/auth/google/callback`, consent screen + scopes
  (`openid email profile`), privacy-policy URL.
- Return origins (`app.locare.co.za`, `app.dantalan.co.za`, agency domains) must
  be in `CORS_ORIGINS` — they're both the exchange-POST origin and the validated
  return-to allowlist.
- CORS: the one-time-code exchange is same-origin per host, but the exchange
  endpoint lives on the API — add each app origin as today.

---

## 7. Phased roadmap

1. **Backend auth** — `users.google_sub` migration; Google OAuth service
   (authorize URL, code exchange, JWKS ID-token verification); `find-or-link`
   (§4); reuse OTP membership-resolution to mint the JWT; `GET /auth/google/start`
   + `GET /auth/google/callback` + one-time-code issue/exchange.
2. **Central callback + return** — signed `state` (origin + nonce), one-time-code
   store, redirect back to origin; `auth.locare.co.za` Caddy route + DNS + env.
3. **Web** — "Continue with Google" button on `/login` (and signup); a
   `/auth/google/return` page that exchanges the code, stores the token, and
   routes via `homeForRole()`. Keep OTP as-is beneath it.
4. **Security/consent** — full ID-token verification, `email_verified` gate,
   link-conflict handling, POPIA consent line + privacy link, rate limits.
5. **Verify + deploy** — tests (token verify, all four link cases, membership
   resolution, pending-tenant), typecheck; deploy runbook (Google Cloud client,
   redirect URI, envs, `auth` DNS/Caddy, `--build api web`, migration).

---

## 8. Later

- Microsoft / Apple sign-in (same central-callback pattern; enterprise agencies
  often use Microsoft).
- Per-agency toggle to show/hide social login on their surface (some may want
  only their own-brand OTP).
- "Manage linked accounts" in profile (link/unlink Google).
