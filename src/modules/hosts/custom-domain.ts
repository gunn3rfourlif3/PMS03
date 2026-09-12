import { isPublicSuffix, parseHost } from './host-name';

/**
 * Turning what an operator types into the value `vendors.custom_domain` needs.
 *
 * Pure, because this decides which domains can obtain a certificate in Locare's
 * name. Setting it used to be a raw SQL statement in the runbook, which is
 * exactly where a typo becomes a certificate request for a domain nobody owns
 * and a Let's Encrypt backoff nobody understands.
 *
 * The stored value is always the BARE domain — `kimaz.co.za`, never
 * `app.kimaz.co.za` and never a URL — because `HostsService` matches a
 * handshake's host against it after stripping the app label. Storing
 * `app.kimaz.co.za` would silently never match.
 */

export type DomainResult =
  | { ok: true; domain: string; changed: boolean }
  | { ok: false; error: string };

/**
 * Accepts what people actually paste: a bare domain, a full URL, a host with a
 * port, an `app.` prefix, trailing slashes and stray whitespace.
 */
export function normaliseCustomDomain(raw: string | null | undefined, platformDomain: string): DomainResult {
  const input = (raw ?? '').trim();
  if (!input) return { ok: false, error: 'Enter a domain, or clear the field to remove it.' };

  // Strip anything URL-shaped before parsing: scheme, credentials, path, query.
  let candidate = input
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@/]*@/, '')
    .split(/[/?#]/)[0]
    .trim();

  if (!candidate) return { ok: false, error: `"${input}" is not a domain.` };

  const { host, base } = parseHost(candidate, platformDomain);
  if (!host || !base) {
    return { ok: false, error: `"${input}" is not a valid domain. Use the agency's bare domain, e.g. agency.co.za.` };
  }

  // `co.za` parses as a perfectly good two-label hostname, but nobody can
  // register it, so it is always a typo — and stored it would sit there
  // matching nothing.
  if (isPublicSuffix(base)) {
    return { ok: false, error: `${base} is a public suffix, not a domain anyone can own. Use the agency's own domain.` };
  }

  const pd = platformDomain.trim().toLowerCase();
  if (pd && (base === pd || base.endsWith(`.${pd}`))) {
    return {
      ok: false,
      error: `${base} belongs to Locare. An agency's custom domain must be their own, not a ${pd} subdomain.`,
    };
  }

  return { ok: true, domain: base, changed: base !== input.toLowerCase() };
}
