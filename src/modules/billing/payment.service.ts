import {
  ConflictException, Inject, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import {
  invoiceOutstanding,
  OWING_INVOICE_STATUSES,
} from '@common/database/invoice-outstanding';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { PAYMENT_PROVIDER } from '@providers/payment/payment-provider.interface';
import type { PaymentProvider } from '@providers/payment/payment-provider.interface';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SubscriptionBillingService } from '@modules/subscriptions/subscription-billing.service';
import { Invoice } from './invoice.entity';
import { Payment, PaymentMethod } from './payment.entity';
import { applyPayment } from './payment-alloc';

/**
 * Money-in loop. initiate() (authenticated) creates a pending Payment and asks
 * the provider to collect; it is idempotent per invoice (a repeat tap returns
 * the existing pending intent instead of creating a duplicate). confirm()
 * (public webhook) resolves the payment's vendor via a SECURITY DEFINER lookup
 * and settles inside that vendor's context: Dr Bank / Cr AR, allocate, advance.
 *
 * ZA PPRA: rent for an owner lands in trust and the platform fee settles
 * separately — no gateway auto-split of client money.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly tenantRunner: TenantRunner,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
    private readonly subscriptionBilling: SubscriptionBillingService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async initiate(
    invoiceId: string,
    method: 'eft' | 'card' = 'eft',
  ): Promise<{ paymentId: string; redirectUrl?: string; reused?: boolean }> {
    const invoices = this.tenant.getRepository(Invoice);
    const invoice = await invoices.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'paid') throw new ConflictException('Invoice already paid');

    const payments = this.tenant.getRepository(Payment);

    // Idempotency: reuse an existing pending intent for this invoice.
    const existing = await payments
      .createQueryBuilder('p')
      .where('p.allocation @> cast(:a as jsonb)', { a: JSON.stringify([{ invoiceId: invoice.id }]) })
      .andWhere("p.status = 'pending'")
      .getOne();
    if (existing) {
      return { paymentId: existing.id, reused: true };
    }

    const result = await this.provider.collect({
      vendorId: this.tenant.vendorId ?? '',
      invoiceId: invoice.id,
      amount: Number(invoice.total),
      currency: 'ZAR',
      method,
    });

    const payment = await payments.save(
      payments.create({
        vendorId: this.tenant.vendorId ?? undefined,
        tenantId: invoice.tenantId,
        amount: Number(invoice.total),
        method,
        gatewayRef: result.providerRef,
        status: result.status === 'succeeded' ? 'succeeded' : 'pending',
        allocation: [{ invoiceId: invoice.id, amount: Number(invoice.total) }],
      }),
    );
    return { paymentId: payment.id, redirectUrl: result.redirectUrl };
  }

  /**
   * The unpaid invoices on a lease, oldest first, with what is actually still
   * owed on each.
   *
   * OUTSTANDING HERE IS NOT THE RENT ROLL'S OUTSTANDING. `ReportingService`
   * sums the FULL total of every invoice whose status is not 'paid', so a
   * R12 000 invoice with R5 000 already received still reads R12 000 there.
   * That is fine for a rough arrears figure and wrong for the screen where
   * someone is about to type an amount, so this subtracts what has been
   * allocated. The rent roll, the ageing buckets and the portfolio state now
   * use this same definition from `invoiceOutstanding`, so the figure a human
   * types against and the figure they read beforehand are the same number.
   *
   * Runs in the caller's vendor context, so RLS scopes it.
   */
  async listOutstandingForLease(leaseId: string): Promise<Array<{
    id: string; period: string; dueDate: string; total: number;
    status: string; outstanding: number;
  }>> {
    return this.tenant.getManager().query(
      `SELECT i.id,
              i.period,
              i.due_date::text AS "dueDate",
              i.total::float8  AS total,
              i.status,
              ${invoiceOutstanding('i')}::float8 AS outstanding
         FROM invoices i
        WHERE i.lease_id = $1
          AND i.status IN ${OWING_INVOICE_STATUSES}
        ORDER BY i.due_date ASC`,
      [leaseId],
    );
  }

  /**
   * Record a manual (off-gateway) payment — e.g. an accepted EFT proof of
   * payment — and settle it exactly like a gateway confirmation:
   *   Dr Bank / Cr AR, allocate, advance the invoice status, notify the tenant.
   * Runs in the caller's (staff) vendor context.
   */
  async recordManual(
    invoiceId: string,
    amount: number,
    opts?: {
      reference?: string;
      method?: PaymentMethod;
      /** Staff user recording it. Null for the gateway and reconciliation paths. */
      confirmedBy?: string;
      /** When the money actually arrived, which is not always today. */
      receivedOn?: Date;
    },
  ): Promise<{ paymentId: string; invoiceStatus: string }> {
    const invoices = this.tenant.getRepository(Invoice);
    const invoice = await invoices.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'paid') throw new ConflictException('Invoice already paid');

    const payments = this.tenant.getRepository(Payment);
    const payment = await payments.save(
      payments.create({
        vendorId: this.tenant.vendorId ?? undefined,
        tenantId: invoice.tenantId,
        amount,
        method: opts?.method ?? 'eft',
        gatewayRef: `manual:${opts?.reference || randomUUID()}`,
        status: 'succeeded',
        receivedAt: opts?.receivedOn ?? new Date(),
        confirmedBy: opts?.confirmedBy,
        allocation: [{ invoiceId: invoice.id, amount }],
      }),
    );

    const [bank, ar] = await Promise.all([
      this.accounting.resolveAccount('BANK'),
      this.accounting.resolveAccount('ACCOUNTS_RECEIVABLE'),
    ]);
    const txnId = await this.ledger.post({
      lines: [
        { accountId: bank.id, debit: amount, entityRef: `payment:${payment.id}` },
        { accountId: ar.id, credit: amount, entityRef: `invoice:${invoice.id}` },
      ],
    });

    const { status } = applyPayment(Number(invoice.total), 0, amount);
    invoice.status = status;
    await invoices.save(invoice);

    payment.status = 'succeeded';
    payment.receivedAt = new Date();
    payment.ledgerTxnId = txnId;
    await payments.save(payment);

    if (payment.tenantId) {
      await this.notifications.enqueue({
        vendorId: this.tenant.vendorId ?? '',
        userId: payment.tenantId,
        template: 'PAYMENT_RECEIVED',
        payload: { amount, currency: 'ZAR' },
      });
    }
    return { paymentId: payment.id, invoiceStatus: status };
  }

  /** Public webhook -> settle in the payment's vendor context. Idempotent. */
  async confirm(gatewayRef: string, succeeded: boolean): Promise<void> {
    const rows = await this.dataSource.query(
      'SELECT payment_vendor_by_ref($1) AS vendor_id',
      [gatewayRef],
    );
    const vendorId: string | undefined = rows[0]?.vendor_id;
    if (!vendorId) {
      // Not a tenant rent payment — it may be an agency's platform-subscription
      // checkout (same gateways/refs, but a platform-scoped invoice). Reconcile
      // that here so subscription payments auto-settle instead of 404ing.
      if (await this.subscriptionBilling.reconcileByGatewayRef(gatewayRef, succeeded)) return;
      throw new NotFoundException('Unknown payment');
    }

    await this.tenantRunner.runInVendorContext(vendorId, async () => {
      const payments = this.tenant.getRepository(Payment);
      const payment = await payments.findOne({ where: { gatewayRef } });
      if (!payment) throw new NotFoundException('Unknown payment');
      if (payment.status === 'succeeded') return;

      if (!succeeded) {
        payment.status = 'failed';
        await payments.save(payment);
        return;
      }

      const alloc = payment.allocation[0];
      const invoices = this.tenant.getRepository(Invoice);
      const invoice = await invoices.findOne({ where: { id: alloc.invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const [bank, ar] = await Promise.all([
        this.accounting.resolveAccount('BANK'),
        this.accounting.resolveAccount('ACCOUNTS_RECEIVABLE'),
      ]);
      const txnId = await this.ledger.post({
        lines: [
          { accountId: bank.id, debit: Number(payment.amount), entityRef: `payment:${payment.id}` },
          { accountId: ar.id, credit: Number(payment.amount), entityRef: `invoice:${invoice.id}` },
        ],
      });

      const { status } = applyPayment(Number(invoice.total), 0, Number(payment.amount));
      invoice.status = status;
      await invoices.save(invoice);

      payment.status = 'succeeded';
      payment.receivedAt = new Date();
      payment.ledgerTxnId = txnId;
      await payments.save(payment);
      this.logger.debug(`Payment ${payment.id} settled -> invoice ${invoice.id} ${status}`);

      if (payment.tenantId) {
        await this.notifications.enqueue({
          vendorId,
          userId: payment.tenantId,
          template: 'PAYMENT_RECEIVED',
          payload: { amount: Number(payment.amount), currency: 'ZAR' },
        });
      }
    });
  }
}
