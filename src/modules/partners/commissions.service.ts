import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { maskBanking } from '@common/security/pii-crypto';
import { Partner, PartnerCommission } from './partner.entities';
import { commissionAmount, withinWindow } from './commission-calc';
import { buildPayoutRun, PayoutCandidate, PAYOUT_FLOOR_DEFAULT } from './payout-run';
import { selfDealingSignals, SelfDealingSignal, SIGNAL_LABELS } from './self-dealing';

/** Rands. Override per environment; see docs §4.1. */
const payoutFloor = () => {
  const n = Number(process.env.PARTNER_PAYOUT_FLOOR);
  return Number.isFinite(n) && n >= 0 ? n : PAYOUT_FLOOR_DEFAULT;
};

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
   *
   * **Basis is cash collected, not billed** (docs/LOCARE_COMMISSION_STRUCTURE.md
   * §4). It sums `subscription_invoices` actually marked paid, keyed on the
   * month the payment landed rather than the month it was billed for — an
   * invoice for July settled in August earns in August, which is when Locare
   * has the money.
   *
   * This replaced accruing on `vendor_subscriptions.mrr`, which paid a partner
   * on subscribed MRR: commission on trials that never converted and on
   * invoices never paid. Paying out on money that had not arrived is how a
   * channel ends up clawing back, and a clawback is the fastest way to lose a
   * partner (§4, "why arrears, and why collected").
   */
  async accrue(period = thisPeriod()): Promise<{ period: string; accrued: number; withheld: number }> {
    const rows: Array<{ partner_id: string; vendor_id: string; collected: string; rate: string; commission_months: number | null; started_at: string }> =
      await this.ds.query(
        `SELECT vs.referred_by_partner_id AS partner_id, si.vendor_id, vs.started_at,
                SUM(si.amount) AS collected,
                p.commission_rate AS rate, p.commission_months
           FROM subscription_invoices si
           JOIN vendor_subscriptions vs ON vs.vendor_id = si.vendor_id
           JOIN partners p ON p.id = vs.referred_by_partner_id
          WHERE si.status = 'paid'
            AND si.paid_at IS NOT NULL
            AND to_char(si.paid_at, 'YYYY-MM') = $1
            AND vs.referred_by_partner_id IS NOT NULL
            -- Belt and braces: a trial should have no paid invoices, but if one
            -- is ever recorded against a trialing subscription it must not earn.
            AND vs.status <> 'trialing'
            AND p.status = 'active'
          GROUP BY vs.referred_by_partner_id, si.vendor_id, vs.started_at,
                   p.commission_rate, p.commission_months`,
        [period],
      );

    // §7.4 — a partner earns nothing on an agency they control. Resolved once
    // per run rather than per row; the set is small and the query is not.
    const blocked = await this.selfDealingBlocks();

    let accrued = 0;
    let withheld = 0;
    for (const r of rows) {
      if (!withinWindow(r.started_at, period, r.commission_months)) continue;
      if (blocked.has(`${r.partner_id}:${r.vendor_id}`)) {
        this.log.warn(
          `Self-dealing: withholding ${period} commission for partner ${r.partner_id} on vendor ${r.vendor_id}`,
        );
        withheld += 1;
        continue;
      }
      const rate = Number(r.rate) || 0;
      const collected = Number(r.collected) || 0;
      const amount = commissionAmount(collected, rate);
      if (amount <= 0) continue;
      // Insert if absent; if a still-pending row exists, refresh its basis/amount.
      // `basis_mrr` now holds cash collected in the period, not subscribed MRR —
      // the column name predates the change in basis and is kept to avoid a
      // rename across the entity, both portals and the admin list.
      await this.ds.query(
        `INSERT INTO partner_commissions (partner_id, vendor_id, period, basis_mrr, rate, amount, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')
         ON CONFLICT (partner_id, vendor_id, period) DO UPDATE
           SET basis_mrr = EXCLUDED.basis_mrr, rate = EXCLUDED.rate, amount = EXCLUDED.amount, updated_at = now()
           WHERE partner_commissions.status = 'pending'`,
        [r.partner_id, r.vendor_id, period, collected, rate, amount],
      );
      accrued += 1;
    }
    this.log.log(
      `Accrued ${accrued} partner commissions for ${period}` +
        (withheld ? ` (${withheld} withheld for self-dealing)` : ''),
    );
    return { period, accrued, withheld };
  }

  // ── Self-dealing (§7.4) ──

  /**
   * Every referred (partner, agency) pair with the partner's contact details
   * and the agency's owners, so signals can be computed in one pass.
   */
  private async selfDealingRows(): Promise<
    Array<{
      partner_id: string; partner_name: string; contact_email: string | null;
      contact_phone: string | null; company: string | null;
      vendor_id: string; vendor_name: string;
      owner_emails: string[]; owner_phones: string[];
    }>
  > {
    return this.ds.query(
      `SELECT p.id AS partner_id, p.name AS partner_name, p.contact_email, p.contact_phone, p.company,
              vs.vendor_id, v.name AS vendor_name,
              COALESCE(array_agg(u.email) FILTER (WHERE u.email IS NOT NULL), '{}') AS owner_emails,
              COALESCE(array_agg(u.phone) FILTER (WHERE u.phone IS NOT NULL), '{}') AS owner_phones
         FROM vendor_subscriptions vs
         JOIN partners p ON p.id = vs.referred_by_partner_id
         JOIN vendors  v ON v.id = vs.vendor_id
         LEFT JOIN memberships m ON m.vendor_id = vs.vendor_id AND m.role = 'vendor_owner'
         LEFT JOIN users u ON u.id = m.user_id
        WHERE vs.referred_by_partner_id IS NOT NULL
        GROUP BY p.id, p.name, p.contact_email, p.contact_phone, p.company, vs.vendor_id, v.name`,
    );
  }

  /** `partnerId:vendorId` keys where the evidence is conclusive. */
  private async selfDealingBlocks(): Promise<Set<string>> {
    const out = new Set<string>();
    for (const r of await this.selfDealingRows()) {
      const { blocking } = selfDealingSignals({
        partnerEmail: r.contact_email, partnerPhone: r.contact_phone,
        partnerName: r.partner_name, partnerCompany: r.company,
        ownerEmails: r.owner_emails, ownerPhones: r.owner_phones,
        vendorName: r.vendor_name,
      });
      if (blocking) out.add(`${r.partner_id}:${r.vendor_id}`);
    }
    return out;
  }

  /**
   * Admin review list. Everything with at least one signal, blocking or not —
   * the weak signals are common enough among legitimate partners that a human
   * has to look, which is exactly why they do not withhold anything by
   * themselves.
   */
  async selfDealingReport(): Promise<
    Array<{
      partnerId: string; partnerName: string; agencyName: string; vendorId: string;
      signals: SelfDealingSignal[]; reasons: string[]; blocking: boolean;
    }>
  > {
    const out = [];
    for (const r of await this.selfDealingRows()) {
      const { signals, blocking } = selfDealingSignals({
        partnerEmail: r.contact_email, partnerPhone: r.contact_phone,
        partnerName: r.partner_name, partnerCompany: r.company,
        ownerEmails: r.owner_emails, ownerPhones: r.owner_phones,
        vendorName: r.vendor_name,
      });
      if (!signals.length) continue;
      out.push({
        partnerId: r.partner_id, partnerName: r.partner_name,
        agencyName: r.vendor_name, vendorId: r.vendor_id,
        signals, reasons: signals.map((s) => SIGNAL_LABELS[s]), blocking,
      });
    }
    return out.sort((a, b) => Number(b.blocking) - Number(a.blocking));
  }

  // ── Payout run (§4.1) ──

  /**
   * What to pay this month. Groups approved-but-unpaid commissions by partner
   * and applies the floor, with the quarter-end sweep releasing everything.
   *
   * Read-only: it produces the run sheet. Money moves by EFT, and `payPartner()`
   * records that it happened.
   */
  async payoutRun(asOf = new Date()) {
    const rows: Array<{
      partner_id: string; partner_name: string; total: string;
      ids: string[]; periods: string[]; has_banking: boolean;
    }> = await this.ds.query(
      `SELECT p.id AS partner_id, p.name AS partner_name,
              SUM(pc.amount) AS total,
              array_agg(pc.id ORDER BY pc.period) AS ids,
              array_agg(DISTINCT pc.period) AS periods,
              (p.banking IS NOT NULL AND p.banking::text <> '{}') AS has_banking
         FROM partner_commissions pc
         JOIN partners p ON p.id = pc.partner_id
        WHERE pc.status = 'approved'
        GROUP BY p.id, p.name, p.banking`,
    );

    const candidates: PayoutCandidate[] = rows.map((r) => ({
      partnerId: r.partner_id,
      partnerName: r.partner_name,
      total: Math.round((Number(r.total) || 0) * 100) / 100,
      commissionIds: r.ids ?? [],
      periods: r.periods ?? [],
      hasBanking: !!r.has_banking,
    }));

    return {
      asOf: asOf.toISOString().slice(0, 10),
      ...buildPayoutRun(candidates, { floor: payoutFloor(), asOf }),
    };
  }

  /** Mark a partner's whole approved balance paid, after the EFT has gone out. */
  async payPartner(partnerId: string, ref?: string): Promise<{ paid: number; amount: number }> {
    const run = await this.payoutRun();
    const line = run.lines.find((l) => l.partnerId === partnerId);
    if (!line) throw new NotFoundException('No approved commissions for that partner.');
    if (!line.payable) {
      throw new BadRequestException(
        `Below the R${run.floor} payout floor (R${line.total}). It rolls over, and the quarterly sweep will release it.`,
      );
    }
    if (line.blocked) throw new BadRequestException(line.blocked);

    await this.ds.query(
      `UPDATE partner_commissions SET status='paid', paid_at=now(), paid_ref=$2, updated_at=now()
        WHERE id = ANY($1) AND status='approved'`,
      [line.commissionIds, ref ?? null],
    );
    this.log.log(`Paid ${line.commissionIds.length} commissions to ${line.partnerName} (R${line.total})`);
    return { paid: line.commissionIds.length, amount: line.total };
  }

  // ── Partner-facing ──
  async listForPartner(partnerId?: string | null): Promise<unknown[]> {
    const id = this.assert(partnerId);
    return this.ds.query(
      `SELECT pc.id, pc.period, pc.basis_mrr AS "basisMrr", pc.rate, pc.amount, pc.status,
              pc.paid_at AS "paidAt", pc.paid_ref AS "paidRef", vendor_name(pc.vendor_id) AS "agencyName"
       FROM partner_commissions pc
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
              pc.paid_ref AS "paidRef", p.name AS "partnerName", vendor_name(pc.vendor_id) AS "agencyName"
       FROM partner_commissions pc
       JOIN partners p ON p.id = pc.partner_id
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
