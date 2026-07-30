import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { maskBanking } from '@common/security/pii-crypto';
import { Partner, PartnerCommission } from './partner.entities';
import { commissionAmount, withinWindow } from './commission-calc';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

@Injectable()
export class PartnerCommissionsService {
  private readonly log = new Logger('PartnerCommissions');
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private commissions() { return this.ds.getRepository(PartnerCommission); }
  private partners() { return this.ds.getRepository(Partner); }
  private assert(partnerId?: string | null): string {
    if (!partnerId) throw new ForbiddenException('No partner context');
    return partnerId;
  }

  /**
   * Accrue commissions for a period across every referred, paying agency. One
   * pending row per (partner, vendor, period) — idempotent, so safe to re-run.
   */
  async accrue(period = thisPeriod()): Promise<{ period: string; accrued: number }> {
    const rows: Array<{ partner_id: string; vendor_id: string; mrr: string; rate: string; commission_months: number | null; started_at: string }> =
      await this.ds.query(
        `SELECT vs.referred_by_partner_id AS partner_id, vs.vendor_id, vs.mrr, vs.started_at,
                p.commission_rate AS rate, p.commission_months
         FROM vendor_subscriptions vs
         JOIN partners p ON p.id = vs.referred_by_partner_id
         WHERE vs.referred_by_partner_id IS NOT NULL
           AND vs.status IN ('active','trialing')
           AND vs.mrr > 0
           AND p.status = 'active'`,
      );

    let accrued = 0;
    for (const r of rows) {
      if (!withinWindow(r.started_at, period, r.commission_months)) continue;
      const rate = Number(r.rate) || 0;
      const amount = commissionAmount(Number(r.mrr), rate);
      if (amount <= 0) continue;
      // Insert if absent; if a still-pending row exists, refresh its basis/amount.
      await this.ds.query(
        `INSERT INTO partner_commissions (partner_id, vendor_id, period, basis_mrr, rate, amount, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')
         ON CONFLICT (partner_id, vendor_id, period) DO UPDATE
           SET basis_mrr = EXCLUDED.basis_mrr, rate = EXCLUDED.rate, amount = EXCLUDED.amount, updated_at = now()
           WHERE partner_commissions.status = 'pending'`,
        [r.partner_id, r.vendor_id, period, Number(r.mrr), rate, amount],
      );
      accrued += 1;
    }
    this.log.log(`Accrued ${accrued} partner commissions for ${period}`);
    return { period, accrued };
  }

  // ── Partner-facing ──
  async listForPartner(partnerId?: string | null): Promise<unknown[]> {
    const id = this.assert(partnerId);
    return this.ds.query(
      `SELECT pc.id, pc.period, pc.basis_mrr AS "basisMrr", pc.rate, pc.amount, pc.status,
              pc.paid_at AS "paidAt", pc.paid_ref AS "paidRef", v.name AS "agencyName"
       FROM partner_commissions pc LEFT JOIN vendors v ON v.id = pc.vendor_id
       WHERE pc.partner_id = $1 ORDER BY pc.period DESC, pc.created_at DESC`, [id],
    );
  }

  async summaryForPartner(partnerId?: string | null): Promise<Record<string, number>> {
    const id = this.assert(partnerId);
    const [r] = await this.ds.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','approved')),0) AS pending,
         COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) AS paid,
         COALESCE(SUM(amount) FILTER (WHERE status='paid' AND period = $2),0) AS paid_mtd
       FROM partner_commissions WHERE partner_id = $1`, [id, thisPeriod()],
    );
    return { pending: Number(r?.pending) || 0, paid: Number(r?.paid) || 0, paidMtd: Number(r?.paid_mtd) || 0 };
  }

  // ── Banking (payout details) ──
  async getBanking(partnerId?: string | null): Promise<Record<string, unknown>> {
    const p = await this.partners().findOne({ where: { id: this.assert(partnerId) } });
    if (!p) throw new NotFoundException('Partner not found');
    return (p.banking ?? {}) as Record<string, unknown>;
  }

  async updateBanking(partnerId: string | null | undefined, banking: Record<string, unknown>): Promise<Record<string, unknown>> {
    const repo = this.partners();
    const p = await repo.findOne({ where: { id: this.assert(partnerId) } });
    if (!p) throw new NotFoundException('Partner not found');
    p.banking = { ...(p.banking ?? {}), ...banking };
    await repo.save(p);
    return maskBanking(p.banking as any);
  }

  // ── Platform-admin ──
  adminList(status?: string): Promise<unknown[]> {
    const where = status && status !== 'all' ? `WHERE pc.status = $1` : '';
    const params = status && status !== 'all' ? [status] : [];
    return this.ds.query(
      `SELECT pc.id, pc.period, pc.amount, pc.status, pc.basis_mrr AS "basisMrr", pc.rate,
              pc.paid_ref AS "paidRef", p.name AS "partnerName", v.name AS "agencyName"
       FROM partner_commissions pc
       JOIN partners p ON p.id = pc.partner_id
       LEFT JOIN vendors v ON v.id = pc.vendor_id
       ${where} ORDER BY pc.period DESC, p.name`, params,
    );
  }

  private async setStatus(id: string, patch: Partial<PartnerCommission>): Promise<PartnerCommission> {
    const repo = this.commissions();
    const c = await repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Commission not found');
    Object.assign(c, patch);
    return repo.save(c);
  }

  approve(id: string) { return this.setStatus(id, { status: 'approved', approvedAt: new Date() }); }
  cancel(id: string) { return this.setStatus(id, { status: 'cancelled' }); }
  async pay(id: string, ref?: string) {
    const c = await this.commissions().findOne({ where: { id } });
    if (!c) throw new NotFoundException('Commission not found');
    if (c.status === 'cancelled') throw new BadRequestException('Cannot pay a cancelled commission.');
    return this.setStatus(id, { status: 'paid', paidAt: new Date(), paidRef: ref });
  }
}
