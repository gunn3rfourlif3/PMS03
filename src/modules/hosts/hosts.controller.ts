import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HostsService } from './hosts.service';

/**
 * PUBLIC: Caddy's on-demand TLS `ask` endpoint.
 *
 *   GET /api/public/tls-check?domain=app.agency.co.za
 *   200 -> issue a certificate for this host
 *   404 -> refuse
 *
 * Unauthenticated by necessity: Caddy cannot present a credential during a
 * handshake. Caddy reads only the status code, so the body is for humans
 * debugging with curl.
 */
@Controller('public')
export class HostsController {
  constructor(private readonly hosts: HostsService) {}

  // Generously above the global 120/min: a 429 is not a 2xx, so Caddy would
  // read a rate-limited response as "refuse" and a legitimate agency's domain
  // would fail to come up. Still bounded, so this cannot become a way to
  // amplify traffic into the database.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Get('tls-check')
  async tlsCheck(@Query('domain') domain?: string): Promise<{ ok: true; host: string }> {
    if (await this.hosts.isAllowed(domain)) {
      return { ok: true, host: (domain ?? '').toLowerCase() };
    }
    // 404 rather than 403: to anyone probing, an unknown host and a refused one
    // should look identical.
    throw new NotFoundException('not served here');
  }
}
