import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

/**
 * Machine-to-machine API key for external integrators. Only a SHA-256 hash of
 * the key is stored; the plaintext is shown once at creation. `prefix` (public,
 * indexed) enables O(1) lookup; `scopes` are the roles the key acts as.
 */
@Entity('api_keys')
export class ApiKey extends TenantEntity {
  @Column() name: string;
  @Index({ unique: true }) @Column() prefix: string;
  @Column({ name: 'key_hash' }) keyHash: string;
  @Column('jsonb', { default: [] }) scopes: string[];
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true }) lastUsedAt?: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt?: Date;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt?: Date;
}
