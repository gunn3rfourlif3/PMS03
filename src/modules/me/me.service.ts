import { Injectable } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Invoice } from '@modules/billing/invoice.entity';
import { Lease } from '@modules/leasing/lease.entity';
import { Notification } from '@modules/notifications/notification.entity';
import { User } from '@modules/identity/user.entity';

/**
 * Tenant self-service reads. Everything is RLS-scoped to the caller's vendor,
 * and additionally filtered to the caller's own userId — a tenant only ever
 * sees their own invoices and lease.
 */
@Injectable()
export class MeService {
  constructor(private readonly tenant: TenantContextService) {}

  profile(userId: string): Promise<Pick<User, 'id' | 'name' | 'email' | 'phone'> | null> {
    return this.tenant.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'phone'],
    });
  }

  invoices(tenantId: string): Promise<Invoice[]> {
    return this.tenant
      .getRepository(Invoice)
      .find({ where: { tenantId }, order: { period: 'DESC' } });
  }

  notifications(userId: string): Promise<Notification[]> {
    return this.tenant.getRepository(Notification).find({ where: { userId }, order: { createdAt: 'DESC' }, take: 40 });
  }

  activeLease(tenantId: string): Promise<Lease | null> {
    return this.tenant
      .getRepository(Lease)
      .findOne({ where: { tenantId, status: 'active' } });
  }
}
