import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

/** Entities a document can attach to (polymorphic owner). */
export type DocOwnerType = 'lease' | 'user' | 'unit' | 'ticket' | 'inspection';
export type DocStatus = 'pending' | 'stored';

/**
 * A stored file (lease, ID, inspection report, certificate, ...). Operational +
 * soft-deletable. Versioned per (ownerType, ownerId, type); access controlled
 * by role scope. Files live in object storage; only metadata lives here.
 */
@Entity('documents')
@Index(['vendorId', 'ownerType', 'ownerId'])
export class Document extends TenantEntity {
  @Column({ name: 'owner_type', type: 'text' }) ownerType: DocOwnerType;
  @Column('uuid', { name: 'owner_id' }) ownerId: string;
  @Column() type: string;                 // e.g. 'lease_agreement', 'id', 'inspection_report'
  @Column({ name: 'storage_key' }) storageKey: string;
  @Column() filename: string;
  @Column({ name: 'content_type' }) contentType: string;
  @Column('int', { default: 1 }) version: number;
  @Column({ name: 'expiry_date', type: 'date', nullable: true }) expiryDate?: string;
  @Column('jsonb', { name: 'access_scope', default: {} })
  accessScope: { roles?: string[] };      // empty => any authenticated vendor user
  @Column({ type: 'text', default: 'pending' }) status: DocStatus;
  @Column('uuid', { name: 'uploaded_by', nullable: true }) uploadedBy?: string;
}
