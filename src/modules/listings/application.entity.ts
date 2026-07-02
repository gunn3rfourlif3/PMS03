import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ApplicationStatus =
  | 'submitted' | 'screening' | 'approved' | 'rejected' | 'withdrawn';

/** A prospective tenant's application against a listing. */
@Entity('applications')
export class Application extends TenantEntity {
  @Column('uuid', { name: 'listing_id' }) listingId: string;
  @Column({ name: 'applicant_name' }) applicantName: string;
  @Column({ name: 'applicant_email' }) applicantEmail: string;
  @Column({ name: 'applicant_phone', nullable: true }) applicantPhone?: string;
  @Index() @Column({ type: 'text', default: 'submitted' }) status: ApplicationStatus;
  @Column('jsonb', { name: 'screening_result', nullable: true })
  screeningResult?: Record<string, unknown>;
  @Column('uuid', { name: 'lease_id', nullable: true }) leaseId?: string;
}
