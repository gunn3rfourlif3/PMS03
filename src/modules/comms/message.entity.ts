import { Entity, Column, Index } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

export type SenderRole = 'tenant' | 'staff';

/** A single message in a conversation. Append-only. */
@Entity('messages')
@Index(['vendorId', 'conversationId'])
export class Message extends ImmutableTenantEntity {
  @Column('uuid', { name: 'conversation_id' }) conversationId: string;
  @Column('uuid', { name: 'sender_user_id' }) senderUserId: string;
  @Column({ name: 'sender_role', type: 'text' }) senderRole: SenderRole;
  @Column({ type: 'text' }) body: string;
}
