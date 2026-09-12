import {
  BadRequestException, Body, ConflictException, Controller, Get, NotFoundException,
  Param, ParseUUIDPipe, Put, UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { normaliseCustomDomain } from './custom-domain';
import { HostsService } from './hosts.service';

/**
 * Platform-admin: an agency's custom domain (gap R-4).
 *
 * This is the last step of runbook stage 2 that was still raw SQL. Bringing a
 * domain live is now: point DNS, set this. Caddy issues the certificate on the
 * first handshake and CORS reads the same allowlist.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/agencies')
export class AdminDomainsController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly hosts: HostsService,
  ) {}

  private get platformDomain(): string {
    return (process.env.PLATFORM_DOMAIN ?? 'locare.co.za').trim().toLowerCase();
  }

  /** What the agency's domain is now, and the hosts it will answer on. */
  @Get(':vendorId/domain')
  async get(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    const [vendor] = await this.ds.query(`SELECT * FROM platform_agency($1)`, [vendorId]);
    if (!vendor) throw new NotFoundException('Agency not found');
    return { ...vendor, hosts: hostsFor(vendor.customDomain) };
  }

  /**
   * Set or clear it. An empty string clears — which is also how a domain is
   * released, and takes effect within the deny cache's ten seconds.
   */
  @Put(':vendorId/domain')
  async set(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() body: { domain?: string | null },
  ) {
    const raw = (body?.domain ?? '').trim();

    if (!raw) {
      const [cleared] = await this.ds.query(`SELECT * FROM platform_set_custom_domain($1, NULL)`, [vendorId]);
      if (!cleared) throw new NotFoundException('Agency not found');
      this.hosts.forget();
      return { ...cleared, hosts: [], cleared: true };
    }

    const parsed = normaliseCustomDomain(raw, this.platformDomain);
    if (!parsed.ok) throw new BadRequestException(parsed.error);

    try {
      const [updated] = await this.ds.query(
        `SELECT * FROM platform_set_custom_domain($1, $2)`, [vendorId, parsed.domain],
      );
      if (!updated) throw new NotFoundException('Agency not found');
      // Without this, a domain just set stays refused for up to ten seconds and
      // the first browse fails — which is precisely when someone is watching.
      this.hosts.forget();
      return { ...updated, hosts: hostsFor(parsed.domain), normalised: parsed.changed };
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('DOMAIN_TAKEN')) {
        throw new ConflictException(`${parsed.domain} is already set on ${msg.split('DOMAIN_TAKEN:')[1] ?? 'another agency'}.`);
      }
      if (msg.includes('VENDOR_NOT_FOUND')) throw new NotFoundException('Agency not found');
      throw e;
    }
  }
}

/** The six hosts an agency answers on once its domain is live. */
const hostsFor = (domain?: string | null): string[] =>
  !domain ? [] : ['app', 'api', 'tenant', 'landlord', 'rentals'].map((l) => `${l}.${domain}`).concat(domain);
