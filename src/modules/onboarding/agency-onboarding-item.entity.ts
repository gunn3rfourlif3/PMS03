import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type OnboardingStatus = 'pending' | 'in_progress' | 'blocked' | 'done' | 'skipped' | 'failed';
/** Who the item is waiting on. Drives the portfolio view's "not moving" column. */
export type WaitingOn = 'locare' | 'agency' | 'third_party';

/**
 * One checklist item for one agency. PLATFORM-SCOPED — no vendor RLS, so this is
 * a plain entity (not TenantEntity); the controller is platform-admin only.
 */
@Entity('agency_onboarding_items')
@Index(['vendorId', 'itemKey'], { unique: true })
export class AgencyOnboardingItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'vendor_id', type: 'uuid' }) vendorId: string;

  /** Which runbook template this item came from; never changes after seeding. */
  @Column({ name: 'template_version', type: 'text' }) templateVersion: string;

  @Column('int') stage: number;
  @Column({ name: 'item_key', type: 'text' }) itemKey: string;
  @Column('text') title: string;
  @Column({ type: 'text', nullable: true }) detail?: string | null;

  @Column({ type: 'text', default: 'pending' }) status: OnboardingStatus;
  @Column({ name: 'waiting_on', type: 'text', default: 'locare' }) waitingOn: WaitingOn;

  /** True when an automated check exists (R-9). Phase 1 ships none. */
  @Column({ type: 'boolean', default: false }) verifiable: boolean;

  /** Estimated operator hours — the unit the progress bar is measured in. */
  @Column({ name: 'weight_hours', type: 'numeric', default: 0 }) weightHours: number;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true }) ownerUserId?: string | null;
  @Column({ name: 'completed_by', type: 'uuid', nullable: true }) completedBy?: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date | null;

  /** What proved it: check output plus timestamp. Null until a check runs. */
  @Column({ type: 'jsonb', nullable: true }) evidence?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true }) notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
