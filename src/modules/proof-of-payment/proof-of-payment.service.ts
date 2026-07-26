import {
  ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { MediaService, UploadedFileLike } from '@modules/media/media.service';
import { PaymentService } from '@modules/billing/payment.service';
import { Invoice } from '@modules/billing/invoice.entity';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';
import { ProofOfPayment } from './proof-of-payment.entity';

export interface SubmitProofInput {
  invoiceId: string;
  amount?: number;
  paidAt?: string;
  reference?: string;
  note?: string;
}

@Injectable()
export class ProofOfPaymentService {
  private readonly log = new Logger('ProofOfPayment');

  constructor(
    private readonly tenant: TenantContextService,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly media: MediaService,
    private readonly payments: PaymentService,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  /** Tenant submits a proof for one of THEIR invoices. */
  async submit(userId: string, input: SubmitProofInput, file: UploadedFileLike): Promise<ProofOfPayment> {
    const invoice = await this.tenant.getRepository(Invoice).findOne({ where: { id: input.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.tenantId !== userId) throw new ForbiddenException('That invoice is not yours.');

    const { url } = await this.media.saveProof(file);
    const repo = this.tenant.getRepository(ProofOfPayment);
    return repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      invoiceId: invoice.id,
      tenantId: userId,
      fileUrl: url,
      amount: input.amount,
      paidAt: input.paidAt,
      reference: input.reference?.trim() || undefined,
      note: input.note?.trim() || undefined,
      status: 'pending',
    }));
  }

  /** A tenant's own submissions. */
  mine(userId: string): Promise<ProofOfPayment[]> {
    return this.tenant.getRepository(ProofOfPayment).find({
      where: { tenantId: userId }, order: { createdAt: 'DESC' },
    });
  }

  /** Staff review queue (optionally filtered by status), with invoice + tenant detail. */
  listForStaff(status?: string): Promise<unknown[]> {
    return this.tenant.getManager().query(
      `SELECT p.id, p.status, p.file_url AS "fileUrl", p.amount, p.paid_at AS "paidAt",
              p.reference, p.note, p.created_at AS "createdAt", p.review_note AS "reviewNote",
              p.invoice_id AS "invoiceId", i.period AS "invoicePeriod", i.total AS "invoiceTotal",
              i.status AS "invoiceStatus", u.name AS "tenantName", u.email AS "tenantEmail"
       FROM proof_of_payments p
       JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN users u ON u.id = p.tenant_id
       WHERE ($1::text IS NULL OR p.status = $1)
       ORDER BY (p.status = 'pending') DESC, p.created_at DESC`,
      [status ?? null],
    );
  }

  /** Staff accepts: reconcile the invoice like a real payment, then notify. */
  async accept(id: string, reviewerId: string): Promise<ProofOfPayment> {
    const repo = this.tenant.getRepository(ProofOfPayment);
    const proof = await repo.findOne({ where: { id } });
    if (!proof) throw new NotFoundException('Proof not found');
    if (proof.status !== 'pending') throw new ConflictException(`Already ${proof.status}`);

    const invoice = await this.tenant.getRepository(Invoice).findOne({ where: { id: proof.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const amount = proof.amount != null ? Number(proof.amount) : Number(invoice.total);

    await this.payments.recordManual(proof.invoiceId, amount, { reference: proof.reference });

    proof.status = 'accepted';
    proof.reviewedBy = reviewerId;
    proof.reviewedAt = new Date();
    const saved = await repo.save(proof);

    await this.notifyTenant(proof.tenantId,
      'Payment confirmed',
      `Thank you — we've received and confirmed your payment${proof.reference ? ` (ref ${proof.reference})` : ''}. Your account has been updated.`,
    ).catch((e) => this.log.error(`notify accept failed: ${e.message}`));
    return saved;
  }

  /** Staff rejects with a reason, then notify. */
  async reject(id: string, reviewerId: string, reason?: string): Promise<ProofOfPayment> {
    const repo = this.tenant.getRepository(ProofOfPayment);
    const proof = await repo.findOne({ where: { id } });
    if (!proof) throw new NotFoundException('Proof not found');
    if (proof.status !== 'pending') throw new ConflictException(`Already ${proof.status}`);

    proof.status = 'rejected';
    proof.reviewNote = reason?.trim() || undefined;
    proof.reviewedBy = reviewerId;
    proof.reviewedAt = new Date();
    const saved = await repo.save(proof);

    await this.notifyTenant(proof.tenantId,
      'About your proof of payment',
      `We couldn't confirm your recent proof of payment${reason ? `: ${reason}` : '.'} Please check the details and resubmit, or contact us if you need help.`,
    ).catch((e) => this.log.error(`notify reject failed: ${e.message}`));
    return saved;
  }

  private async notifyTenant(tenantId: string, subject: string, body: string): Promise<void> {
    if (!this.channels) return;
    const rows = await this.ds.query('SELECT email, phone FROM users WHERE id = $1', [tenantId]);
    const u = rows[0];
    const to = u?.email || u?.phone;
    if (!to) return;
    const provider = this.channels.get(u?.email ? 'email' : 'sms');
    if (!provider) return;
    const res = await provider.send({ to, subject, body });
    if (!res.ok) this.log.error(`notify to ${to} failed: ${res.error ?? 'unknown'}`);
  }
}
