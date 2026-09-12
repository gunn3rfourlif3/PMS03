import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parseHost } from './host-name';

/**
 * Decides which hostnames this deployment will obtain a TLS certificate for.
 *
 * Caddy's on-demand TLS asks this before issuing, so it is the only thing
 * standing between "an agency sets their domain in the back-office and it just
 * works" and "anyone who points a domain at this IP gets a certificate issued
 * in Locare's name and burns our Let's Encrypt budget".
 *
 * Therefore: deny is the default, and every allow traces to either the platform
 * allowlist in env or an ACTIVE vendor row. See
 * docs/LOCARE_ONDEMAND_TLS_DESIGN.md.
 */
@Injectable()
export class HostsService {
  private readonly log = new Logger('Hosts');

  /**
   * Decisions are cached because Caddy asks once per handshake for an unknown
   * host, and a client retrying during issuance produces a small burst.
   *
   * Positives last a minute. Negatives last ten seconds — long enough to blunt
   * someone probing for which domains exist, short enough that an operator who
   * has just set a domain is not left staring at a failure they already fixed.
   */
  private readonly cache = new Map<string, { allowed: boolean; expires: number }>();
  private static readonly TTL_ALLOW_MS = 60_000;
  private static readonly TTL_DENY_MS = 10_000;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private get platformDomain(): string {
    return (process.env.PLATFORM_DOMAIN ?? 'locare.co.za').trim().toLowerCase();
  }

  /** Hosts served regardless of the database, so the platform can never lock itself out. */
  private get platformHosts(): Set<string> {
    const pd = this.platformDomain;
    const extra = (process.env.TLS_EXTRA_HOSTS ?? '')
      .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
    return new Set([pd, `www.${pd}`, `app.${pd}`, `api.${pd}`, ...extra]);
  }

  /**
   * Browser origins the API accepts, resolved per request rather than fixed at
   * boot.
   *
   * Same source of truth as the TLS check on purpose. If these two could
   * disagree, a new agency would get a valid certificate, serve the app, and
   * then have every API call blocked by the browser — an app that looks broken
   * while the logs stay clean. `CORS_ORIGINS` is still consulted first, so the
   * platform's own origins never depend on a database lookup.
   */
  async isAllowedOrigin(origin?: string | null): Promise<boolean> {
    // No Origin header: not a browser cross-origin request (curl, a webhook,
    // server-to-server). There is nothing to police here.
    if (!origin) return true;

    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }

    const isProd = process.env.NODE_ENV === 'production';
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(localhost && !isProd)) return false;
    if (localhost) return !isProd;

    // Exact match on the configured list, normalised for a stray trailing slash.
    const normalised = origin.trim().toLowerCase().replace(/\/+$/, '');
    if (this.staticOrigins.has(normalised)) return true;

    return this.isAllowed(url.hostname);
  }

  /** `CORS_ORIGINS`, the boot-time allowlist. Env is fixed at container creation. */
  private get staticOrigins(): Set<string> {
    return new Set(
      (process.env.CORS_ORIGINS ?? '')
        .split(',').map((o) => o.trim().toLowerCase().replace(/\/+$/, '')).filter(Boolean),
    );
  }

  async isAllowed(rawHost?: string | null): Promise<boolean> {
    const { host, base, slug } = parseHost(rawHost, this.platformDomain);
    if (!host || !base) return false;

    const hit = this.cache.get(host);
    if (hit && hit.expires > Date.now()) return hit.allowed;

    const allowed = this.platformHosts.has(host) || (await this.vendorClaims(base, slug));
    this.remember(host, allowed);
    if (!allowed) this.log.warn(`host not served: ${host} — no active vendor claims ${base}`);
    return allowed;
  }

  /**
   * Runs with no tenant context — an unauthenticated handshake has none — so it
   * goes through a SECURITY DEFINER function that returns a boolean and nothing
   * else, and therefore cannot be used to read vendor data.
   *
   * A database failure denies. Refusing a certificate is recoverable; issuing
   * one for a host we cannot vouch for is not.
   */
  private async vendorClaims(base: string, slug: string): Promise<boolean> {
    try {
      const rows = await this.ds.query('SELECT tls_host_allowed($1,$2) AS ok', [base, slug]);
      return rows?.[0]?.ok === true;
    } catch (e: any) {
      this.log.error(`tls-check lookup failed for ${base}: ${e.message} — denying`);
      return false;
    }
  }

  /**
   * Drop the cache.
   *
   * Called when a custom domain changes. Without it a domain just set stays
   * refused for up to the deny TTL, and the first browse after setting it fails
   * — which is exactly the moment someone is watching. Clearing everything
   * rather than one key is deliberate: one domain change can affect several
   * host entries, and the cache refills in milliseconds.
   */
  forget(): void {
    this.cache.clear();
  }

  private remember(host: string, allowed: boolean): void {
    // Bounded so a flood of distinct hostnames cannot grow this without limit.
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(host, {
      allowed,
      expires: Date.now() + (allowed ? HostsService.TTL_ALLOW_MS : HostsService.TTL_DENY_MS),
    });
  }
}
