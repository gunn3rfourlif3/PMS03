import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { ESIGN_PROVIDER } from '@providers/esign/esign-provider.interface';
import type { EsignProvider } from '@providers/esign/esign-provider.interface';
import { Document } from './document.entity';
import { SignatureRequest, SignatureStatus } from './signature-request.entity';

/**
 * E-signature orchestration. requestSignature() (authenticated) creates a
 * provider request against a stored document. handleCallback() (public webhook)
 * resolves the request's vendor via a SECURITY DEFINER lookup, then advances the
 * request in that vendor's context. Idempotent by providerRef.
 */
@Injectable()
export class EsignService {
  private readonly logger = new Logger(EsignService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly tenantRunner: TenantRunner,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ESIGN_PROVIDER) private readonly provider: EsignProvider,
  ) {}

  async requestSignature(
    documentId: string,
    signerEmail: string,
    signerName?: string,
  ): Promise<{ signatureRequestId: string; signUrl: string }> {
    const docs = this.tenant.getRepository(Document);
    const doc = await docs.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');

    const result = await this.provider.createSignatureRequest({
      documentKey: doc.storageKey,
      signerEmail,
      signerName,
      subject: `Please sign: ${doc.type}`,
    });

    const repo = this.tenant.getRepository(SignatureRequest);
    const sig = await repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        documentId,
        provider: this.provider.name,
        providerRef: result.providerRef,
        signerEmail,
        signUrl: result.signUrl,
        status: 'sent',
      }),
    );
    return { signatureRequestId: sig.id, signUrl: result.signUrl };
  }

  /** Public webhook -> advance the request in its vendor context. Idempotent. */
  async handleCallback(providerRef: string, status: SignatureStatus): Promise<void> {
    const rows = await this.dataSource.query(
      'SELECT signature_vendor_by_ref($1) AS vendor_id',
      [providerRef],
    );
    const vendorId: string | undefined = rows[0]?.vendor_id;
    if (!vendorId) throw new NotFoundException('Unknown signature request');

    await this.tenantRunner.runInVendorContext(vendorId, async () => {
      const repo = this.tenant.getRepository(SignatureRequest);
      const sig = await repo.findOne({ where: { providerRef } });
      if (!sig) throw new NotFoundException('Unknown signature request');
      if (sig.status === status) return;
      sig.status = status;
      if (status === 'signed') sig.completedAt = new Date();
      await repo.save(sig);
      this.logger.debug(`Signature ${providerRef} -> ${status}`);
    });
  }
}
