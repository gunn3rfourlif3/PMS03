import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { Partner, PartnerMember } from './partner.entities';

const SIGNUP_BASE = () => (process.env.PARTNER_SIGNUP_BASE || process.env.SIGN_BASE || 'https://app.dantalan.co.za').replace(/\/$/, '');

@Injectable()
export class PartnersService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private partners() { return this.ds.getRepository(Partner); }
  private members() { return this.ds.getRepository(PartnerMember); }

  private assert(partnerId?: string | null): string {
    if (!partnerId) throw new ForbiddenException('No partner context');
    return partnerId;
  }

  async me(partnerId?: string | null): Promise<Partner> {
    const p = await this.partners().findOne({ where: { id: this.assert(partnerId) } });
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }

  /** Portal overview metrics (commission fields are Phase 2 — 0 for now). */
  async overview(partnerId?: string | null): Promise<Record<string, number>> {
    const id = this.assert(partnerId);
    const [row] = await this.ds.query(
      `SELECT
         (SELECT COALESCE(SUM(expected_mrr),0) FROM partner_deals
            WHERE partner_id=$1 AND stage IN ('lead','contacted','demo','trial','proposal')) AS "pipelineValue",
         (SELECT COUNT(*) FROM partner_deals
            WHERE partner_id=$1 AND stage IN ('lead','contacted','demo','trial','proposal')) AS "activeDeals",
         (SELECT COUNT(*) FROM partner_activities
            WHERE partner_id=$1 AND type='demo' AND created_at > now() - interval '7 days') AS "demosThisWeek",
         (SELECT COUNT(*) FROM vendor_subscriptions
            WHERE referred_by_partner_id=$1 AND status IN ('active','trialing')) AS "agenciesSigned",
         (SELECT COALESCE(SUM(mrr),0) FROM vendor_subscriptions
            WHERE referred_by_partner_id=$1 AND status IN ('active','trialing')) AS "referredMrr"`,
      [id],
    );
    return {
      pipelineValue: Number(row?.pipelineValue) || 0,
      activeDeals: Number(row?.activeDeals) || 0,
      demosThisWeek: Number(row?.demosThisWeek) || 0,
      agenciesSigned: Number(row?.agenciesSigned) || 0,
      referredMrr: Number(row?.referredMrr) || 0,
      commissionMtd: 0, commissionPending: 0, commissionPaid: 0,
    };
  }

  /** Live agencies this partner referred. Uses vendor_name() — `vendors` is RLS. */
  async agencies(partnerId?: string | null): Promise<unknown[]> {
    const id = this.assert(partnerId);
    return this.ds.query(
      `SELECT vs.vendor_id AS "vendorId", vendor_name(vs.vendor_id) AS "agencyName", vs.tier, vs.status,
              vs.unit_count AS "unitCount", vs.mrr, vs.created_at AS "joinedAt"
       FROM vendor_subscriptions vs
       WHERE vs.referred_by_partner_id = $1
       ORDER BY vs.created_at DESC`, [id],
    );
  }

  /** PUBLIC: validate a referral code, returning the partner's name for display. */
  async validateRef(refCode: string): Promise<{ valid: boolean; partnerName?: string }> {
    const [p] = await this.ds.query(`SELECT name FROM partners WHERE ref_code = $1 AND status = 'active'`, [refCode]);
    return p ? { valid: true, partnerName: p.name } : { valid: false };
  }

  /** PUBLIC: an agency self-signs-up via a partner's referral link (admin-approved). */
  async publicSignup(refCode: string, input: { agencyName: string; ownerName: string; ownerEmail: string }): Promise<{ ok: true }> {
    if (!refCode?.trim()) throw new BadRequestException('A referral code is required.');
    if (!input.agencyName?.trim() || !input.ownerEmail?.trim()) throw new BadRequestException('Agency name and owner email are required.');
    await this.ds.query(`SELECT signup_agency($1,$2,$3,$4)`, [
      refCode.trim(), input.agencyName.trim(), input.ownerName?.trim() || 'Owner', input.ownerEmail.trim().toLowerCase(),
    ]);
    return { ok: true };
  }

  /** Platform-admin: pending referral signups awaiting approval. */
  listPendingSignups(): Promise<unknown[]> {
    return this.ds.query(
      `SELECT vs.vendor_id AS "vendorId", vendor_name(vs.vendor_id) AS "agencyName",
              p.name AS "partnerName", vs.created_at AS "signedUpAt"
       FROM vendor_subscriptions vs JOIN partners p ON p.id = vs.referred_by_partner_id
       WHERE vs.status = 'pending' AND vs.referred_by_partner_id IS NOT NULL
       ORDER BY vs.created_at DESC`,
    );
  }

  async approveSignup(vendorId: string): Promise<{ ok: true }> {
    await this.ds.query(`SELECT approve_agency($1)`, [vendorId]);
    return { ok: true };
  }

  async referral(partnerId?: string | null): Promise<{ refCode: string; signupUrl: string }> {
    const p = await this.me(partnerId);
    return { refCode: p.refCode, signupUrl: `${SIGNUP_BASE()}/signup?ref=${encodeURIComponent(p.refCode)}` };
  }

  /**
   * Attribution B: partner creates a new agency directly. Uses the SECURITY
   * DEFINER provision_agency() so vendor/owner/subscription rows are written
   * atomically without an RLS context. Records a won deal + signup activity.
   */
  async onboardAgency(
    partnerId: string | null | undefined,
    input: { agencyName: string; slug?: string; ownerName: string; ownerEmail: string; expectedUnits?: number },
  ): Promise<{ vendorId: string }> {
    const id = this.assert(partnerId);
    if (!input.agencyName?.trim() || !input.ownerEmail?.trim()) {
      throw new BadRequestException('Agency name and owner email are required.');
    }
    const [row] = await this.ds.query(
      `SELECT provision_agency($1,$2,$3,$4,$5) AS vendor_id`,
      [id, input.agencyName.trim(), (input.slug ?? '').trim(), input.ownerName?.trim() || 'Owner', input.ownerEmail.trim().toLowerCase()],
    );
    const vendorId = row?.vendor_id;
    await this.ds.query(
      `INSERT INTO partner_deals (partner_id, prospect_name, contact_email, stage, expected_units, source, vendor_id, stage_changed_at)
       VALUES ($1,$2,$3,'won',$4,'manual',$5, now())`,
      [id, input.agencyName.trim(), input.ownerEmail.trim().toLowerCase(), Number(input.expectedUnits) || 0, vendorId],
    );
    await this.ds.query(
      `INSERT INTO partner_activities (partner_id, type, summary) VALUES ($1,'signup',$2)`,
      [id, `Onboarded agency "${input.agencyName.trim()}"`],
    );
    return { vendorId };
  }

  // ── Platform-admin: partner management ────────────────────────────────────
  private genRefCode(name: string): string {
    const base = (name || 'PT').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'PT';
    return `${base}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  listPartners(): Promise<Partner[]> {
    return this.partners().find({ order: { createdAt: 'DESC' } });
  }

  async createPartner(input: { name: string; contactEmail?: string; contactPhone?: string; company?: string; commissionRate?: number; commissionMonths?: number | null }): Promise<Partner> {
    if (!input.name?.trim()) throw new BadRequestException('Partner name is required.');
    const repo = this.partners();
    const p = repo.create({
      name: input.name.trim(),
      contactEmail: input.contactEmail?.trim().toLowerCase(),
      contactPhone: input.contactPhone,
      company: input.company,
      refCode: this.genRefCode(input.name),
      status: 'active',
      commissionRate: input.commissionRate ?? Number(process.env.PARTNER_DEFAULT_RATE ?? 0.10),
      commissionMonths: input.commissionMonths ?? undefined,
    });
    return repo.save(p);
  }

  async setPartnerStatus(id: string, status: Partner['status']): Promise<Partner> {
    const repo = this.partners();
    const p = await repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Partner not found');
    p.status = status;
    return repo.save(p);
  }

  /** Grant a person a login into a partner (creates the user by email if needed). */
  async addMember(partnerId: string, email: string, name?: string): Promise<{ ok: true }> {
    if (!email?.trim()) throw new BadRequestException('Email is required.');
    const [u] = await this.ds.query(
      `INSERT INTO users (name, email) VALUES ($1,$2)
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name) RETURNING id`,
      [name?.trim() || null, email.trim().toLowerCase()],
    );
    const userId = u?.id ?? (await this.ds.query(`SELECT id FROM users WHERE email=$1`, [email.trim().toLowerCase()]))[0]?.id;
    await this.members().createQueryBuilder()
      .insert().values({ partnerId, userId, role: 'partner_owner' })
      .orIgnore().execute();
    return { ok: true };
  }
}
