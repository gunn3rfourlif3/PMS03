import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ImportEntity } from './import-fields';

export type ImportStatus = 'mapping' | 'dry_run' | 'committed' | 'discarded';

/**
 * One uploaded file on its way in. PLATFORM-SCOPED — no vendor RLS; the
 * controller is platform-admin only and every query scopes by vendorId.
 */
@Entity('import_batches')
@Index(['vendorId', 'createdAt'])
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'vendor_id', type: 'uuid' }) vendorId: string;
  @Column({ type: 'text' }) entity: ImportEntity;
  @Column({ type: 'text', default: 'mapping' }) status: ImportStatus;

  @Column({ type: 'text' }) filename: string;
  /** Which sheet of a multi-sheet workbook this batch is reading. */
  @Column({ name: 'sheet_name', type: 'text', nullable: true }) sheetName?: string | null;

  /** The uploaded bytes. Nulled the moment the batch is finished with. */
  @Column({ type: 'bytea', nullable: true, select: false }) source?: Buffer | null;

  /** Hash of the uploaded bytes, so a commit can refuse a file that changed. */
  @Column({ name: 'source_digest', type: 'text' }) sourceDigest: string;

  @Column({ type: 'jsonb', default: () => "'[]'" }) headers: string[];
  /** Column index -> Locare field key. */
  @Column({ type: 'jsonb', default: () => "'{}'" }) mapping: Record<string, string>;

  /** The dry-run result the operator reviewed. */
  @Column({ type: 'jsonb', nullable: true }) report?: Record<string, unknown> | null;

  @Column({ name: 'row_count', type: 'int', default: 0 }) rowCount: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true }) uploadedBy?: string | null;
  @Column({ name: 'committed_by', type: 'uuid', nullable: true }) committedBy?: string | null;
  @Column({ name: 'committed_at', type: 'timestamptz', nullable: true }) committedAt?: Date | null;

  /** Tags every ledger entry this batch posted, so a set can be found and reversed. */
  @Column({ name: 'ledger_batch_ref', type: 'text', nullable: true }) ledgerBatchRef?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
