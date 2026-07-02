import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type InspectionType = 'move_in' | 'move_out' | 'periodic';
export type InspectionStatus = 'draft' | 'completed' | 'signed_off';

export interface InspectionItem {
  area: string;                                  // e.g. 'Kitchen'
  condition: 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
  photos?: string[];                             // storage keys (Documents module)
  deductionAmount?: number;                      // proposed deposit deduction
}

/**
 * Move-in / move-out / periodic inspection. The move-out checklist's
 * deductionAmount items justify deposit-return withholdings with an audit trail.
 */
@Entity('inspections')
@Index(['vendorId', 'unitId'])
export class Inspection extends TenantEntity {
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @Column('uuid', { name: 'lease_id', nullable: true }) leaseId?: string;
  @Column({ type: 'text' }) type: InspectionType;
  @Index() @Column({ type: 'text', default: 'draft' }) status: InspectionStatus;
  @Column('jsonb', { default: [] }) checklist: InspectionItem[];
  @Column({ name: 'tenant_signoff', default: false }) tenantSignoff: boolean;
  @Column({ name: 'conducted_on', type: 'date', nullable: true }) conductedOn?: string;
  @Column('uuid', { name: 'report_document_id', nullable: true }) reportDocumentId?: string;
}
