import { Entity, Column, Index } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

export type SignatureStatus = 'sent' | 'signed' | 'declined' | 'expired';

/** An e-signature request against a Document. Status advances via webhook. */
@Entity('signature_requests')
export class SignatureRequest extends ImmutableTenantEntity {
  @Column('uuid', { name: 'document_id' }) documentId: string;
  @Column() provider: string;
  @Index({ unique: true }) @Column({ name: 'provider_ref' }) providerRef: string;
  @Column({ name: 'signer_email' }) signerEmail: string;
  @Column({ name: 'sign_url' }) signUrl: string;
  @Index() @Column({ type: 'text', default: 'sent' }) status: SignatureStatus;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
}
