import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PAYMENT_PROVIDER } from '@providers/payment/payment-provider.interface';
import type { PaymentProvider } from '@providers/payment/payment-provider.interface';
import { SubscriptionInvoice } from './subscription-invoice.entity';
import { effectivePrice } from './subscription-calc';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * Bills agencies for their platform subscription. Invoices are generated monthly
 * from each paying subscription's MRR; an agency pays via the gateway (redirect)
 * and a platform admin can also mark an invoice paid manually (EFT).
 */
@Injectable()
export class SubscriptionBillingService {
  private readonly log = new Logger('SubscriptionBilling');
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private repo() { return this.ds.getRepository(SubscriptionInvoice); }

  /**
   * One issued invoice per paying agency for the period. Idempotent.
   *
   * Bills `effectivePrice`, not `mrr`: an agency on a negotiated price
   * (§7.2 grandfathering) keeps its real tier and list price on the
   * subscription row, and is invoiced what it was promised. The selection is
   * deliberately NOT filtered on `mrr > 0` alone — an agency whose override is
   * positive must still be billed even if the ladder would price it at zero.
   */
  async generate(period = thisPeriod()): Promise<{ period: string; generated: number; skipped: number }> {
    const subs: Array<{
      vendor_id: string; tier: string; unit_count: number; mrr: string;
      price_override: string | null; price_override_until: string | null;
    }> = await this.ds.query(
      `SELECT vendor_id, tier, unit_count, mrr, price_override, price_override_until
         FROM vendor_subscriptions
        WHERE status = 'active' AND (mrr > 0 OR price_override IS NOT NULL)`,
    );

    let generated = 0;
    let skipped = 0;
    for (const s of subs) {
      const { amount, overridden } = effectivePrice(
        { tier: s.tier, mrr: s.mrr, priceOverride: s.price_override, priceOverrideUntil: s.price_override_until },
      );

      // A zero invoice is not a debt; raising one gives the agency a payable
      // that cannot be paid and puts a R0 row into the collected-revenue
      // figures the leaderboard and commission accrual read.
      if (!(amount > 0)) { skipped += 1; continue; }

      await this.ds.query(
        `INSERT INTO subscription_invoices (vendor_id, period, tier, unit_count, amount, status, due_date)
         VALUES ($1,$2,$3,$4,$5,'issued',$6)
         ON CONFLICT (vendor_id, period) DO UPDATE
           SET tier = EXCLUDED.tier, unit_count = EXCLUDED.unit_count, amount = EXCLUDED.amount, updated_at = now()
           WHERE subscription_invoices.status = 'issued'`,
        [s.vendor_id, period, s.tier, s.unit_count, amount, `${period}-07`],
      );
      if (overridden) {
        this.log.log(`Vendor ${s.vendor_id} billed negotiated price ${amount} for ${period} (tier ${s.tier} lists at ${s.mrr})`);
      }
      generated += 1;
    }
    this.log.log(`Generated ${generated} subscription invoices for ${period} (${skipped} skipped at zero)`);
    return { period, generated, skipped };
  }

  // ── Agency-facing ──
  listForVendor(vendorId: string): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, period, tier, unit_count AS "unitCount", amount, status,
              due_date AS "dueDate", paid_at AS "paidAt"
       FROM subscription_invoices WHERE vendor_id = $1 ORDER BY period DESC`, [vendorId],
    );
  }

  /** Create a gateway checkout for one of the agency's own invoices. */
  async createCheckout(vendorId: string, invoiceId: string, payerEmail?: string): Promise<{ redirectUrl?: string; providerRef: string }> {
    const [inv] = await this.ds.query(`SELECT * FROM subscription_invoices WHERE id = $1 AND vendor_id = $2`, [invoiceId, vendorId]);
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'paid') throw new BadRequestException('This invoice is already paid.');
    const res = await this.provider.collect({
      vendorId, invoiceId: `sub_${invoiceId}`, amount: Number(inv.amount), currency: 'ZAR', payerEmail,
    });
    await this.ds.query(`UPDATE subscription_invoices SET gateway_ref = $2, updated_at = now() WHERE id = $1`, [invoiceId, res.providerRef]);
    return { redirectUrl: res.redirectUrl, providerRef: res.providerRef };
  }

  // ── Platform-admin ──
  adminList(status?: string): Promise<unknown[]> {
    const where = status && status !== 'all' ? `WHERE si.status = $1` : '';
    const params = status && status !== 'all' ? [status] : [];
    return this.ds.query(
      `SELECT si.id, si.period, si.tier, si.unit_count AS "unitCount", si.amount, si.status,
              si.due_date AS "dueDate", si.paid_ref AS "paidRef", vendor_name(si.vendor_id) AS "agencyName"
       FROM subscription_invoices si ${where} ORDER BY si.period DESC, "agencyName"`, params,
    );
  }

  /**
   * Auto-reconcile a subscription invoice when the payment gateway confirms its
   * checkout. Matched by the `gateway_ref` stored in createCheckout — the same
   * ref the provider webhook reconstructs. Idempotent (a repeat callback on an
   * already-paid invoice is a no-op). Returns true when a subscription invoice
   * owned this ref, so the webhook sink knows the callback was handled here and
   * shouldn't 404.
   */
  async reconcileByGatewayRef(gatewayRef: string, succeeded: boolean): Promise<boolean> {
    const [inv] = await this.ds.query(
      `SELECT id, status FROM subscription_invoices WHERE gateway_ref = $1`, [gatewayRef],
    );
    if (!inv) return false; // not a subscription payment
    if (!succeeded) {
      this.log.warn(`Subscription checkout ${gatewayRef} reported failed; leaving invoice ${inv.id} unpaid`);
      return true;
    }
    if (inv.status === 'paid') return true; // already settled — idempotent
    await this.ds.query(
      `UPDATE subscription_invoices
         SET status = 'paid', paid_at = now(), paid_ref = $2, updated_at = now()
       WHERE id = $1 AND status <> 'paid'`,
      [inv.id, gatewayRef],
    );
    this.log.log(`Subscription invoice ${inv.id} auto-reconciled from gateway ref ${gatewayRef}`);
    return true;
  }

  /**
   * Record a manual (EFT) settlement. Idempotent on `paid_at`.
   *
   * The `status <> 'paid'` guard matters more than it looks: `paid_at` is the
   * month a payment counts in for commission accrual and the partner
   * leaderboard. Marking an already-paid invoice paid again would restamp it to
   * today and silently move that revenue from the month it arrived into the
   * current one — moving a partner's commission with it.
   */
  async markPaid(id: string, ref?: string): Promise<{ ok: true; alreadyPaid: boolean }> {
    const [inv] = await this.ds.query(`SELECT status FROM subscription_invoices WHERE id = $1`, [id]);
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'paid') {
      this.log.warn(`Invoice ${id} is already paid; leaving paid_at untouched`);
      return { ok: true, alreadyPaid: true };
    }
    await this.ds.query(
      `UPDATE subscription_invoices
          SET status = 'paid', paid_at = now(), paid_ref = $2, updated_at = now()
        WHERE id = $1 AND status <> 'paid'`,
      [id, ref ?? null],
    );
    return { ok: true, alreadyPaid: false };
  }

  async void(id: string): Promise<{ ok: true }> {
    await this.ds.query(`UPDATE subscription_invoices SET status = 'void', updated_at = now() WHERE id = $1`, [id]);
    return { ok: true };
  }
}
