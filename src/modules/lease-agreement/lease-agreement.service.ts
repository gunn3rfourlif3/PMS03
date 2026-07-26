import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { MediaService } from '@modules/media/media.service';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';
import { LeaseAgreement } from './lease-agreement.entity';
import { renderLeaseAgreement, mergeLeaseTemplate, LEASE_PLACEHOLDERS, LeaseAgreementData } from './lease-agreement.html';

export interface CreateLeaseAgreementInput {
  leaseId: string;
  tenantId: string;
  unitId: string;
  tenantName: string;
  tenantEmail?: string;
  tenantIdNumber?: string;
  rentAmount: number;
  startDate: string;
  endDate?: string;
  depositAmount?: number;
}

@Injectable()
export class LeaseAgreementService {
  private readonly log = new Logger('LeaseAgreement');
  private readonly signBase = (process.env.SIGN_BASE ?? '').replace(/\/+$/, '');

  constructor(
    private readonly tenant: TenantContextService,
    private readonly tenantRunner: TenantRunner,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly media: MediaService,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  /** Generate a lease agreement for a lease and email the tenant a signing link. */
  async createForLease(input: CreateLeaseAgreementInput): Promise<{ ref: string; signUrl: string; fileUrl: string }> {
    const [unitRow] = await this.tenant.getManager().query(
      `SELECT u.label AS "unitLabel", p.name AS "propertyName", p.address AS address
       FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = $1`,
      [input.unitId],
    );
    const [vendorRow] = await this.tenant.getManager().query(
      `SELECT name, config FROM vendors WHERE id = $1`, [this.tenant.vendorId],
    );
    const branding = (typeof vendorRow?.config === 'string' ? JSON.parse(vendorRow.config) : vendorRow?.config)?.branding ?? {};
    const contact = branding.contact ?? {};

    const data: LeaseAgreementData = {
      agencyName: vendorRow?.name ?? 'Your agency',
      agencyEmail: contact.email,
      agencyPhone: contact.phone,
      tenantName: input.tenantName,
      tenantEmail: input.tenantEmail,
      tenantIdNumber: input.tenantIdNumber,
      propertyName: unitRow?.propertyName ?? '',
      unitLabel: unitRow?.unitLabel,
      addressText: formatAddress(unitRow?.address),
      rentAmount: input.rentAmount,
      depositAmount: input.depositAmount,
      startDate: input.startDate,
      endDate: input.endDate,
      generatedOn: new Date().toISOString().slice(0, 10),
    };

    const { url: fileUrl } = await this.media.saveHtml(await this.renderHtml(data));
    const ref = `las_${randomUUID()}`;
    const repo = this.tenant.getRepository(LeaseAgreement);
    await repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      ref,
      fileUrl,
      renderData: data as unknown as Record<string, unknown>,
      status: 'sent',
    }));

    const signUrl = `${this.signBase}/sign/${ref}`;
    await this.email(input.tenantEmail,
      `Please sign your lease agreement — ${data.agencyName}`,
      `Hi ${input.tenantName?.split(' ')[0] || 'there'},\n\nYour lease agreement is ready to sign. Please review and sign it here:\n${signUrl}\n\nOnce signed, we'll finalise everything. Thank you.\n\n— ${data.agencyName}`,
    ).catch((e) => this.log.error(`sign email failed: ${e.message}`));

    return { ref, signUrl, fileUrl };
  }

  /** PUBLIC: what the signing page needs, resolved by the unguessable ref. */
  async publicGet(ref: string): Promise<{ status: string; fileUrl: string; signerName?: string; signedAt?: string }> {
    const rows = await this.ds.query('SELECT public_lease_agreement($1) AS d', [ref]);
    const d = rows[0]?.d;
    const parsed = typeof d === 'string' ? JSON.parse(d) : d;
    if (!parsed) throw new NotFoundException('This signing link is not valid.');
    return { status: parsed.status, fileUrl: parsed.fileUrl, signerName: parsed.signerName, signedAt: parsed.signedAt };
  }

  /** PUBLIC: the tenant signs. Idempotent; records name, time and IP. */
  async complete(ref: string, fullName: string, ip?: string): Promise<{ status: string }> {
    if (!fullName || fullName.trim().length < 2) throw new BadRequestException('Please enter your full name to sign.');
    const rows = await this.ds.query('SELECT public_lease_agreement($1) AS d', [ref]);
    const d = rows[0]?.d;
    const parsed = typeof d === 'string' ? JSON.parse(d) : d;
    if (!parsed?.vendorId) throw new NotFoundException('This signing link is not valid.');

    await this.tenantRunner.runInVendorContext(parsed.vendorId, async () => {
      const repo = this.tenant.getRepository(LeaseAgreement);
      const row = await repo.findOne({ where: { ref } });
      if (!row) throw new NotFoundException('Not found');
      if (row.status === 'signed') return;

      const signedAt = new Date();
      const data = row.renderData as unknown as LeaseAgreementData;
      // Re-render (custom template or fallback) with the signature block appended.
      const signedHtml = await this.renderHtml({
        ...data,
        signature: { name: fullName, signedAt: signedAt.toISOString(), ip },
      });
      const { url } = await this.media.saveHtml(signedHtml);

      row.status = 'signed';
      row.signerName = fullName;
      row.signerIp = ip;
      row.signedAt = signedAt;
      row.fileUrl = url;
      await repo.save(row);

      await this.email(data.tenantEmail, `Lease signed — ${data.agencyName}`,
        `Thank you, ${fullName.split(' ')[0]}. We've recorded your signed lease agreement. Welcome aboard!\n\n— ${data.agencyName}`)
        .catch(() => undefined);
      await this.email(data.agencyEmail, `Lease agreement signed by ${fullName}`,
        `${fullName} has electronically signed their lease agreement${data.propertyName ? ` for ${data.propertyName}` : ''} on ${signedAt.toISOString()}.`)
        .catch(() => undefined);
    });

    return { status: 'signed' };
  }

  /** Render the lease HTML using the agency's own template, or the built-in SA starter. */
  private async renderHtml(data: LeaseAgreementData): Promise<string> {
    const [row] = await this.tenant.getManager().query('SELECT config FROM vendors WHERE id = $1', [this.tenant.vendorId]);
    const config = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config ?? {});
    const template: string = (config.leaseTemplate ?? '').trim();
    return template ? mergeLeaseTemplate(template, data) : renderLeaseAgreement(data);
  }

  /** Staff: read the agency's lease template + the list of usable placeholders. */
  async getTemplate(): Promise<{ template: string; placeholders: string[] }> {
    const [row] = await this.tenant.getManager().query('SELECT config FROM vendors WHERE id = $1', [this.tenant.vendorId]);
    const config = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config ?? {});
    return { template: config.leaseTemplate ?? '', placeholders: [...LEASE_PLACEHOLDERS] };
  }

  /** Staff: save the agency's lease template. Empty string reverts to the built-in default. */
  async setTemplate(template: string): Promise<{ template: string }> {
    await this.tenant.getManager().query(
      `UPDATE vendors SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('leaseTemplate', $1::text),
              updated_at = now() WHERE id = $2`,
      [template ?? '', this.tenant.vendorId],
    );
    return { template: template ?? '' };
  }

  /** Staff: agreements for a lease (or all). */
  list(leaseId?: string): Promise<LeaseAgreement[]> {
    const repo = this.tenant.getRepository(LeaseAgreement);
    return repo.find({ where: leaseId ? { leaseId } : {}, order: { createdAt: 'DESC' } });
  }

  private async email(to: string | undefined, subject: string, body: string): Promise<void> {
    if (!to || !this.channels) return;
    const provider = this.channels.get('email');
    if (!provider) return;
    const res = await provider.send({ to, subject, body });
    if (!res.ok) this.log.error(`email to ${to} failed: ${res.error ?? 'unknown'}`);
  }
}

function formatAddress(a: any): string {
  if (!a || typeof a !== 'object') return '';
  const parts = [a.line1, a.street, a.suburb, a.city, a.province].filter(Boolean);
  return parts.join(', ');
}
