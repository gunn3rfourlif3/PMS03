import {
  BadRequestException, Body, ConflictException, Controller, Post, UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { OnboardingService } from '@modules/onboarding/onboarding.service';
import { NewAgencyInput, planNewAgency } from './new-agency';

/**
 * Platform-admin: create a direct-sold agency (gap R-3).
 *
 * The partner channel has had this since day one; a direct sale had to be
 * provisioned by hand in SQL on the VPS, which is stage 1.1 of the runbook and
 * the first thing that cannot be delegated.
 *
 * Creation also seeds the onboarding checklist, so an agency that exists is an
 * agency visible in the console. It deliberately sends the owner nothing — the
 * sale often closes before anyone is ready for them to log in, and the first
 * email an agency gets from Locare should be sent on purpose.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/agencies')
export class AdminAgenciesController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly onboarding: OnboardingService,
  ) {}

  /**
   * Price and validate without writing anything, so the form can show the tier
   * and the monthly price as the operator types — and can surface the
   * below-minimum rule before they have filled in the rest.
   */
  @Post('preview')
  preview(@Body() body: NewAgencyInput) {
    const result = planNewAgency(body ?? {});
    return result.ok
      ? { ok: true, ...result.plan }
      : { ok: false, error: result.error, field: result.field ?? null };
  }

  @Post()
  async create(@Body() body: NewAgencyInput) {
    const result = planNewAgency(body ?? {});
    if (!result.ok) throw new BadRequestException(result.error);
    const p = result.plan;

    let vendorId: string;
    try {
      const [row] = await this.ds.query(
        `SELECT platform_create_agency($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS vendor_id`,
        [
          p.agencyName, p.slug, p.ownerName, p.ownerEmail, p.tier, p.unitCount, p.mrr,
          p.priceOverride, p.priceOverrideReason, p.priceOverrideUntil,
        ],
      );
      vendorId = row?.vendor_id;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('SLUG_TAKEN')) {
        throw new ConflictException(
          `The web address "${p.slug}" is already used by ${msg.split('SLUG_TAKEN:')[1]?.trim() || 'another agency'}.`,
        );
      }
      if (msg.includes('SLUG_REQUIRED')) throw new BadRequestException('The agency needs a web address.');
      throw e;
    }
    if (!vendorId) throw new BadRequestException('The agency could not be created.');

    // Best-effort: an agency that exists without its checklist is recoverable
    // with one button, so a seeding failure must not lose the agency.
    let seeded = 0;
    try {
      seeded = (await this.onboarding.seed(vendorId)).created;
    } catch { /* the console's own Start onboarding button covers this */ }

    return { vendorId, ...p, onboardingItems: seeded };
  }
}
