import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { User } from './user.entity';
import { Membership, MembershipStatus } from './membership.entity';

@Injectable()
export class IdentityService {
  constructor(
    private readonly tenant: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  ping(): string {
    return 'Identity module ready';
  }

  /**
   * Get-or-create a user by email and ensure they hold a tenant membership in
   * the current vendor. Used when the applicant funnel approves an application.
   *
   * users is not vendor-scoped (pre-auth), so it's read/written via the root
   * DataSource; memberships IS vendor-scoped, so it's written through the
   * request/job tenant context (RLS + vendor stamping).
   */
  async ensureTenantUser(
    email: string,
    name?: string,
    phone?: string,
    status: MembershipStatus = 'active',
  ): Promise<string> {
    const users = this.dataSource.getRepository(User);
    let user = await users.findOne({ where: { email } });
    if (!user) {
      user = await users.save(users.create({ email, name, phone }));
    }

    const memberships = this.tenant.getRepository(Membership);
    const existing = await memberships.findOne({ where: { userId: user.id } });
    if (!existing) {
      await memberships.save(
        memberships.create({
          vendorId: this.tenant.vendorId ?? undefined,
          userId: user.id,
          role: 'tenant',
          status,
          scope: {},
        }),
      );
    }
    return user.id;
  }

  /**
   * Grant app access to a tenant whose membership was created 'pending' (e.g.
   * after they sign their lease). Idempotent and vendor-scoped via RLS.
   */
  async activateTenantMembership(userId: string): Promise<void> {
    const memberships = this.tenant.getRepository(Membership);
    const m = await memberships.findOne({ where: { userId, role: 'tenant' } });
    if (m && m.status !== 'active') {
      m.status = 'active';
      await memberships.save(m);
    }
  }
}
