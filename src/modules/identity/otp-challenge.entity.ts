import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * Passwordless OTP challenge (pre-auth, so NOT vendor-scoped).
 * Stores only a hash of the code, never the code itself.
 */
@Entity('otp_challenges')
export class OtpChallenge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() destination: string; // phone or email
  @Column({ name: 'code_hash' }) codeHash: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt?: Date;
  @Column('int', { default: 0 }) attempts: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
