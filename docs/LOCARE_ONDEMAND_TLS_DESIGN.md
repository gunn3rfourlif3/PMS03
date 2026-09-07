# Locare — on-demand TLS for agency domains

Written 2026-09-05. Owner: Arthur. Status: design, not built.

Resolves **R-1** in `LOCARE_AGENCY_ONBOARDING_REQUIREMENTS.md`, and makes R-4
and R-6 small. The goal is one sentence:

> An operator sets an agency's domain in the back-office. The agency points DNS
> at the VPS. Their six hosts come up on valid TLS with **no Caddyfile edit, no
> container restart and no SSH.**

---

## 1. How it works today, and why it blocks handover

`deploy/Caddyfile` has one hand-written block per host. Six blocks per agency,
plus a Caddy restart — `caddy reload` silently no-ops on this box, so it is
`docker restart $(docker ps -qf name=caddy)`.

That is a root shell on the production VPS in the middle of every onboarding.
It is the reason a Reseller earning 26% cannot finish the job they are paid for.

## 2. The mechanism

Caddy's **on-demand TLS** issues a certificate during the first TLS handshake
for a hostname it has never seen. To stop it issuing certificates for anything
anyone points at the IP, it first asks an HTTP endpoint whether that hostname is
allowed. That endpoint is the security boundary, and it is the whole design.

```
 tenant browses  ──►  TLS handshake for app.newagency.co.za
                       │
                       ▼
              Caddy: unknown host, ask first
                       │  GET /api/public/tls-check?domain=app.newagency.co.za
                       ▼
              API: strip "app.", look up vendors.custom_domain
                       │  200 = allowed · 404 = refuse
                       ▼
              Caddy issues via Let's Encrypt, caches in caddy_data, serves
```

The agency's row in `vendors.custom_domain` — which an operator sets in the UI
under R-4 — becomes the single source of truth for which domains this box will
serve. Nothing else needs to change to bring an agency live.

## 3. The ask endpoint

`GET /api/public/tls-check?domain=<host>` — public, unauthenticated (Caddy
cannot present a credential), and answering only 200 or 404.

**Rules, in order:**

1. Normalise: lowercase, strip any port, strip a trailing dot, reject anything
   that is not a plausible hostname.
2. Allow the platform's own hosts — `locare.co.za`, `www.`, `app.`, `api.` —
   from a small env allowlist, so the platform is never dependent on a DB row.
3. Strip a known app label if present: `app.`, `api.`, `tenant.`, `landlord.`,
   `rentals.`, `www.`. What remains is the agency's base domain.
4. Allow if an **active** vendor has that base domain in `custom_domain`, or if
   the host is `<slug>.locare.co.za` for an active vendor's slug.
5. Otherwise 404.

Both lookups run with no tenant context, so they go through a narrow
`SECURITY DEFINER` function returning a boolean and nothing else — the same
pattern as `public_branding()` and `payment_vendor_by_ref()`:

```sql
CREATE OR REPLACE FUNCTION tls_host_allowed(p_base text, p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vendors
    WHERE status = 'active'
      AND (custom_domain = p_base OR (p_slug <> '' AND slug = p_slug))
  );
$$;
```

**Cache positive answers in memory for ~60 seconds.** Caddy asks once per
unknown host per handshake attempt, but a client retrying during issuance can
produce a small burst, and this endpoint must never become a way to probe the
database.

**Never answer 200 by default.** A permissive fallback here means anyone who
points a domain at 169.58.46.223 gets a free certificate issued in Locare's
name and burns Let's Encrypt rate limits. Deny is the safe answer, and a denied
host simply fails its handshake — no other host is affected.

Exempt the route from the global throttler, or give it a high dedicated limit:
a 429 to Caddy reads as "not allowed" and would refuse a legitimate agency.

## 4. Caddy configuration

### 4.1 Global

```
{
	email admin@locare.co.za
	on_demand_tls {
		ask http://api:3000/api/public/tls-check
	}
}
```

**`ask` is the only option here.** Caddy removed the built-in `interval`/`burst`
issuance limiter; including either makes the server refuse to start — it cost a
two-minute outage on 2026-09-07 (§8b). The allowlist endpoint is therefore not
one layer of two, it is the entire control, which is why it denies by default.

### 4.2 A catch-all site block, added **after** the existing ones

Caddy matches the most specific site address first, so every existing block —
Locare's and Dantalan's — keeps its exact configuration and its existing
certificate. The catch-all only ever handles hosts nothing else matches, which
makes this a strictly additive change and an easy rollback.

```
# Any host not matched above: allowed agency domains, certificated on demand.
https:// {
	tls { on_demand }
	encode zstd gzip

	@app header_regexp host Host ^app\.
	handle @app {
		@assets path /_next/static/* /brand/*
		handle @assets { reverse_proxy web:3001 }
		handle {
			reverse_proxy web:3001 { header_down Cache-Control "no-cache" }
		}
	}

	@api header_regexp host Host ^api\.
	handle @api { reverse_proxy api:3000 }

	@tenant header_regexp host Host ^tenant\.
	handle @tenant { reverse_proxy tenant:80 }

	@landlord header_regexp host Host ^landlord\.
	handle @landlord { reverse_proxy landlord:80 }

	# Apex, www and rentals all serve the public rentals site.
	handle {
		redir / /rentals
		reverse_proxy web:3001
	}
}
```

The `header_down Cache-Control "no-cache"` on the back-office is not
decoration: Next sets its own `Cache-Control`, a plain `header` directive loses
to it, and a stale prerendered page pointing at old chunk hashes is how a deploy
appears to half-break. Keep it identical to the existing blocks.

**Matcher syntax is the one thing to verify rather than trust.** Caddy's `host`
matcher treats `*` as exactly one label, so `app.*` does *not* match
`app.agency.co.za`. The regex form above avoids that trap, but validate before
restarting:

```bash
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod \
  exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

## 5. CORS must move at the same time (R-6)

Without this, a new agency's domain gets a valid certificate, serves the app,
and then every API call is blocked by the browser — an app that looks broken
while the logs stay clean. That is a worse failure than the one being fixed.

`main.ts` builds the CORS allowlist once at boot from `CORS_ORIGINS`. Replace
the static array with a function that answers per request: env origins first,
then `https://<label>.<custom_domain>` for any active vendor, cached for a
minute. Same source of truth as the TLS check, so the two can never disagree.

## 6. Failure modes

| What happens | Result | Notes |
|---|---|---|
| API is down when a **new** host is first visited | No certificate issued; that host fails until the API returns | Existing certificates live in `caddy_data` and keep serving. A restart does not re-ask |
| Agency's DNS not pointed yet | Handshake never reaches us; nothing to do but wait | Check with `nslookup` before blaming the config |
| Someone points their own domain at the IP | 404 from the ask endpoint, no certificate | This is the attack the endpoint exists to stop |
| `caddy_data` volume lost | Every certificate re-issued on demand | Re-issuing many at once can hit Let's Encrypt limits. Reinforces the backup gap in the status brief — `backup.sh` covers Postgres only |
| Agency suspended or `custom_domain` cleared | Existing certificate keeps serving until it expires | Renewal re-asks and is refused. To cut access immediately, remove the DNS or add an explicit deny — worth knowing before it is needed |

**Let's Encrypt limits** are per registered domain, so each agency domain has its
own budget and only `*.locare.co.za` slug hosts share one (50 certificates per
week — ample). The real risk is a mass re-issue, not normal operation.

## 7. Build order

1. **Ask endpoint + SQL function + unit tests.** ✅ **Built 2026-09-05** —
   `src/modules/hosts/`, migration `1720000044000-TlsHostAllowlist`,
   `test/tls-host.spec.ts` (35 assertions). Deployed it changes nothing: the
   endpoint simply exists and answers correctly. Verify by hand with the
   Dantalan domain (200) and a domain we do not serve (404).
2. **Dynamic CORS.** ✅ **Built 2026-09-05** — `HostsService.isAllowedOrigin()`,
   wired in `main.ts`. Existing origins keep working because the env list is
   still consulted first.
3. **Caddy global + catch-all block.** ✅ **Written 2026-09-05** in
   `deploy/Caddyfile` — global `on_demand_tls` plus an `http://` redirect and an
   `https://` catch-all appended after every explicit block. **Not yet applied:**
   validate in the container, then restart Caddy. Existing hosts are untouched
   by construction.
4. **Prove it end to end** with a real throwaway domain: set `custom_domain`,
   point DNS, browse `app.<domain>` and watch the certificate issue in the Caddy
   logs. Do this before an agency is watching.
5. Only then remove the per-host blocks for Dantalan, if you want to — there is
   no need, and leaving them is one less thing changing at once.

**Rollback** at any point: delete the catch-all block and restart Caddy. Every
explicit block is untouched, so the platform returns to exactly today's
behaviour.

## 8. Tests worth writing

- Host normalisation: port stripped, trailing dot stripped, uppercase, an
  IP address, an empty string, a 300-character string.
- Label stripping: `app.x.co.za` → `x.co.za`; a bare `x.co.za` stays itself;
  `app.co.za` is not mistaken for a label plus a TLD.
- Allowed for an active vendor, **refused for a suspended one** — this is the
  security assertion, and the one most likely to regress.
- Refused for an unknown domain.
- Cache: a second call within the window does not hit the database.

## 8a. Config drift found while applying this (2026-09-07)

The live `deploy/Caddyfile` had 66 lines the repo did not: a second project
(BuddhaPets — `cms.`, apex and `www.`) and the `tenant.`/`landlord.locare.co.za`
blocks, all added directly on the VPS and never committed.

It surfaced because a `git pull` reported "Already up to date" and a Caddy
restart came up on the old config — the giveaway being hosts in the
`enabling automatic TLS certificate management` list that appear nowhere in the
repo. The trap underneath it was worse than the delay: resolving the drift with
`git checkout deploy/Caddyfile` would have deleted a live third-party site's
configuration at the next restart.

Those blocks are now in the repo, and the file carries a warning at the top.
**Worth doing the same audit for `deploy/.env.prod`**, which is not in git at all
and is the other place where the box and the repo can disagree — this time with
no diff to catch it.

## 8b. Outage while applying step 3 (2026-09-07)

`on_demand_tls { interval 2m; burst 5 }` was written from an older form of the
documentation. Caddy has removed those options, and rather than warning it
refuses to adapt the config — so the container entered a restart loop and every
site on the box, including an unrelated third-party one, went down for about two
minutes until the previous Caddyfile was restored.

`caddy validate` would have caught it. It was run, but as a separate command in
the same pasted block as `docker restart`, so its failure scrolled past and the
restart proceeded anyway.

**The procedure now chains them**, so a failed validation cannot be followed by a
restart:

```bash
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod \
  exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  && docker restart $(docker ps -aqf name=caddy)
```

Two smaller lessons kept from the same hour:

- `docker ps -qf` finds nothing when the container has exited; the restart then
  silently does nothing. Use `-aqf`.
- Adaptation stops at the first error, so a config that fails early has had its
  later blocks parsed by nothing. A clean validate after fixing one error is not
  evidence the rest was ever checked.

## 9. What this does not solve

DNS is still the agency's job and still the most common delay, so Stage 0.6 of
the runbook — identifying who controls DNS on day one — matters exactly as much
after this lands as before.

Nothing here touches R-2 (operator access is still an environment variable), R-3
(no UI to create a direct-sold agency) or R-5 (no data import). This removes the
step that blocks *every* onboarding; those three remain.
