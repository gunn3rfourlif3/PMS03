/**
 * Hostname parsing for the TLS allowlist. Pure — no framework, no DB — because
 * this is the security boundary for certificate issuance and it has to be
 * exhaustively testable on its own.
 *
 * Mirrors `web-admin/lib/brand-shared.ts` (`brandKeyFromHost`): the same host
 * must resolve to the same agency in both places, or a domain gets a
 * certificate and then renders the wrong brand.
 */

/** Sub-labels that belong to the platform's surfaces, not to an agency. */
const APP_LABELS = new Set(['app', 'api', 'tenant', 'landlord', 'rentals', 'www']);

/**
 * Public suffixes an agency domain can sit under. Not a full PSL — this is the
 * SA market plus the handful a South African agency plausibly uses — and its
 * only job is to stop `app.co.za` being read as the label `app` in front of the
 * domain `co.za`. Nobody can register a public suffix, so a wrong answer here
 * would only ever produce a base that no vendor can claim; the list keeps the
 * parse honest rather than guarding the decision.
 *
 * `web-admin/lib/brand-shared.ts` does not make this distinction, because there
 * a wrong brand key only shows the wrong logo. Here it feeds a certificate
 * decision, so it is worth the extra care.
 */
const PUBLIC_SUFFIXES = new Set([
  'co.za', 'org.za', 'net.za', 'web.za', 'gov.za', 'ac.za',
  'co.uk', 'org.uk', 'com.au', 'co.nz', 'co.ke', 'co.bw', 'co.zw',
]);

/** Conservative: letters, digits, hyphens, dots. No underscores, no trailing hyphen. */
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export interface ParsedHost {
  /** The full normalised hostname, or null when it is not a usable one. */
  host: string | null;
  /** The agency's domain: the host with any app label removed. */
  base: string | null;
  /** `<slug>` when the host is `<slug>.<platformDomain>`, else ''. */
  slug: string;
}

/**
 * Lowercase, drop a port, drop a trailing root dot, and reject anything that
 * is not a plain hostname — an IP address, `localhost`, a single label, an
 * over-long string, anything with a path or scheme smuggled into it.
 */
export function normaliseHost(raw?: string | null): string | null {
  const host = (raw ?? '').trim().toLowerCase().split(':')[0].replace(/\.$/, '');
  if (!host || host === 'localhost') return null;
  // A bare IPv4 or anything IPv6-shaped never gets a public certificate here.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes('[') || host.includes('%')) return null;
  return HOSTNAME.test(host) ? host : null;
}

/**
 * Split a hostname into the parts the allowlist needs.
 *
 * `app.agency.co.za`      -> base `agency.co.za`
 * `agency.co.za`          -> base `agency.co.za`   (apex is served too)
 * `app.acme.locare.co.za` -> base `acme.locare.co.za`, slug `acme`
 *
 * An app label is only stripped when something remains that is still a domain,
 * so `app.co.za` is treated as a domain in its own right rather than as a label
 * in front of a TLD.
 */
export function parseHost(raw: string | null | undefined, platformDomain: string): ParsedHost {
  const host = normaliseHost(raw);
  if (!host) return { host: null, base: null, slug: '' };

  const labels = host.split('.');
  const remainder = labels.slice(1).join('.');
  // Strip an app label only when what is left is still a registrable domain:
  // at least two labels, and not a public suffix in its own right.
  const strippable =
    labels.length > 2 &&
    APP_LABELS.has(labels[0]) &&
    !PUBLIC_SUFFIXES.has(remainder) &&
    remainder.split('.').length >= 2;
  const base = strippable ? remainder : host;

  const pd = platformDomain.trim().toLowerCase();
  const suffix = `.${pd}`;
  const slug = pd && base.endsWith(suffix) ? base.slice(0, -suffix.length) : '';

  // A slug is one label. `a.b.locare.co.za` is not a tenant slug.
  return { host, base, slug: slug.includes('.') ? '' : slug };
}
