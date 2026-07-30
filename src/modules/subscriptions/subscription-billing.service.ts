import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PAYMENT_PROVIDER } from '@providers/payment/payment-provider.interface';
import type { PaymentProvider } from '@providers/payment/payment-provider.interface';
import { SubscriptionInvoice } from './subscription-invoice.entity';

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

  /** One issued invoice per paying agency for the period. Idempotent. */
  async generate(period = thisPeriod()): Promise<{ period: string; generated: number }> {
    const subs: Array<{ vendor_id: string; tier: string; unit_count: number; mrr: string }> =
      await this.ds.query(
        `SELECT vendor_id, tier, unit_count, mrr FROM vendor_subscriptions WHERE status = 'active' AND mrr > 0`,
      );
    let generated = 0;
    for (const s of subs) {
      await this.ds.query(
        `INSERT INTO subscription_invoices (vendor_id, period, tier, unit_count, amount, status, due_date)
         VALUES ($1,$2,$3,$4,$5,'issued',$6)
         ON CONFLICT (vendor_id, period) DO UPDATE
           SET tier = EXCLUDED.tier, unit_count = EXCLUDED.unit_count, amount = EXCLUDED.amount, updated_at = now()
           WHERE subscription_invoices.status = 'issued'`,
        [s.vendor_id, period, s.tier, s.unit_count, Number(s.mrr), `${period}-07`],
      );
      generated += 1;
    }
    this.log.log(`Generated ${generated} subscription invoices for ${period}`);
    return { period, generated };
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

  async markPaid(id: string, ref?: string): Promise<{ ok: true }> {
    const [inv] = await this.ds.query(`SELECT status FROM subscription_invoices WHERE id = $1`, [id]);
    if (!inv) throw new NotFoundException('Invoice not found');
    await this.ds.query(
      `UPDATE subscription_invoices SET status = 'paid', paid_at = now(), paid_ref = $2, updated_at = now() WHERE id = $1`, [id, ref ?? null],
    );
    return { ok: true };
  }

  async void(id: string): Promise<{ ok: true }> {
    await this.ds.query(`UPDATE subscription_invoices SET status = 'void', updated_at = now() WHERE id = $1`, [id]);
    return { ok: true };
  }
}
