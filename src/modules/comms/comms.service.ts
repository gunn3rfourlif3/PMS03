import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Conversation } from './conversation.entity';
import { Message, SenderRole } from './message.entity';
import { CommsEvents } from './comms.events';

export interface Principal {
  userId: string;
  roles: string[];
}

const STAFF_ROLES = ['vendor_owner', 'property_manager'];
const isStaff = (roles: string[] = []) => roles.some((r) => STAFF_ROLES.includes(r));
const preview = (body: string) => (body.length > 120 ? body.slice(0, 117) + '…' : body);

/**
 * In-app messaging. Threads are between one tenant and the vendor's staff.
 * Tenants only see their own conversations; staff see every conversation in
 * the vendor. RLS already scopes everything to the vendor.
 */
@Injectable()
export class CommsService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly events: CommsEvents,
  ) {}

  ping(): string {
    return 'Comms module ready';
  }

  private convos() { return this.tenant.getRepository(Conversation); }
  private msgs() { return this.tenant.getRepository(Message); }

  /** Staff inbox - every conversation, newest activity first. */
  async inbox(): Promise<unknown[]> {
    return this.tenant.getManager().query(`
      SELECT c.id, c.subject, c.status, c.unit_id AS "unitId",
             c.last_message_at AS "lastMessageAt", c.last_message_preview AS "lastMessagePreview",
             u.name AS "tenantName", u.email AS "tenantEmail",
             (c.last_message_at IS NOT NULL
               AND (c.staff_last_read_at IS NULL OR c.last_message_at > c.staff_last_read_at)) AS "unread"
      FROM conversations c
      LEFT JOIN users u ON u.id = c.tenant_user_id
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
    `);
  }

  /** A tenant's own conversations. */
  async mine(userId: string): Promise<unknown[]> {
    return this.tenant.getManager().query(`
      SELECT c.id, c.subject, c.status, c.unit_id AS "unitId",
             c.last_message_at AS "lastMessageAt", c.last_message_preview AS "lastMessagePreview",
             (c.last_message_at IS NOT NULL
               AND (c.tenant_last_read_at IS NULL OR c.last_message_at > c.tenant_last_read_at)) AS "unread"
      FROM conversations c
      WHERE c.tenant_user_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
    `, [userId]);
  }

  /** Unread thread count for whichever side is asking (for a nav badge). */
  async unreadCount(p: Principal): Promise<{ count: number }> {
    const staff = isStaff(p.roles);
    const rows = staff
      ? await this.tenant.getManager().query(`
          SELECT COUNT(*)::int AS n FROM conversations c
          WHERE c.last_message_at IS NOT NULL
            AND (c.staff_last_read_at IS NULL OR c.last_message_at > c.staff_last_read_at);`)
      : await this.tenant.getManager().query(`
          SELECT COUNT(*)::int AS n FROM conversations c
          WHERE c.tenant_user_id = $1 AND c.last_message_at IS NOT NULL
            AND (c.tenant_last_read_at IS NULL OR c.last_message_at > c.tenant_last_read_at);`, [p.userId]);
    return { count: rows[0]?.n ?? 0 };
  }

  private async loadFor(id: string, p: Principal): Promise<Conversation> {
    const c = await this.convos().findOne({ where: { id } });
    if (!c) throw new NotFoundException('Conversation not found');
    if (!isStaff(p.roles) && c.tenantUserId !== p.userId) {
      throw new ForbiddenException('Not your conversation');
    }
    return c;
  }

  /** Thread view - marks the asking side's messages as read. */
  async thread(id: string, p: Principal): Promise<{ conversation: Conversation; messages: Message[] }> {
    const c = await this.loadFor(id, p);
    const messages = await this.msgs().find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    const now = new Date();
    if (isStaff(p.roles)) c.staffLastReadAt = now; else c.tenantLastReadAt = now;
    await this.convos().save(c);
    return { conversation: c, messages };
  }

  /** Tenant (or staff, for outreach) starts a new thread with a first message. */
  async start(p: Principal, data: { subject: string; body: string; unitId?: string; tenantUserId?: string }): Promise<Conversation> {
    const staff = isStaff(p.roles);
    // Staff outreach must name the tenant; tenants open their own thread.
    const tenantUserId = staff ? data.tenantUserId : p.userId;
    if (!tenantUserId) throw new ForbiddenException('A tenant is required to start a conversation.');

    const now = new Date();
    const repo = this.convos();
    const c = await repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      subject: data.subject?.trim() || 'New message',
      tenantUserId,
      unitId: data.unitId,
      status: 'open',
      lastMessageAt: now,
      lastMessagePreview: preview(data.body),
      staffLastReadAt: staff ? now : undefined,
      tenantLastReadAt: staff ? undefined : now,
    }));
    await this.postMessage(c, p, data.body, staff ? 'staff' : 'tenant');
    return c;
  }

  /** Add a reply to an existing thread. */
  async reply(id: string, p: Principal, body: string): Promise<Message> {
    const c = await this.loadFor(id, p);
    const staff = isStaff(p.roles);
    const msg = await this.postMessage(c, p, body, staff ? 'staff' : 'tenant');
    if (c.status === 'closed') c.status = 'open'; // a reply reopens
    await this.convos().save(c);
    return msg;
  }

  private async postMessage(c: Conversation, p: Principal, body: string, role: SenderRole): Promise<Message> {
    const text = (body ?? '').trim();
    if (!text) throw new ForbiddenException('Message body is required.');
    const now = new Date();
    const repo = this.msgs();
    const msg = await repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      conversationId: c.id,
      senderUserId: p.userId,
      senderRole: role,
      body: text,
    }));
    c.lastMessageAt = now;
    c.lastMessagePreview = preview(text);
    // Sender has implicitly read their own thread up to now.
    if (role === 'staff') c.staffLastReadAt = now; else c.tenantLastReadAt = now;
    await this.convos().save(c);
    this.events.publish({ vendorId: c.vendorId, tenantUserId: c.tenantUserId, conversationId: c.id, at: now.toISOString() });
    return msg;
  }

  async setStatus(id: string, p: Principal, status: 'open' | 'closed'): Promise<Conversation> {
    const c = await this.loadFor(id, p);
    c.status = status;
    return this.convos().save(c);
  }
}
