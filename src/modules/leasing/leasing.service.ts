import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Lease, LeaseType } from './lease.entity';

export interface CreateLeaseInput {
  unitId: string;
  tenantId?: string;
  rentAmount: number;
  startDate: string;      // 'YYYY-MM-DD'
  endDate?: string;
  type?: LeaseType;
  billingCycle?: string;
}

@Injectable()
export class LeasingService {
  constructor(private readonly tenant: TenantContextService) {}

  ping(): string {
    return 'Leasing module ready';
  }

  /** Active leases with unit label + term, for the renewals view. */
  list(): Promise<unknown[]> {
    return this.tenant.getManager().query(`
      SELECT l.id, u.label AS unit, l.tenant_id, l.rent_amount, l.type, l.status, l.start_date, l.end_date, l.escalation
      FROM leases l JOIN units u ON u.id = l.unit_id
      WHERE l.status = 'active' AND l.deleted_at IS NULL
      ORDER BY u.label;
    `);
  }

  /** Renew a lease: apply an escalation % to rent and extend the term. Keeps a history. */
  async renew(id: string, input: { escalationPct?: number; months?: number; newEndDate?: string }): Promise<Lease> {
    const repo = this.tenant.getRepository(Lease);
    const lease = await repo.findOne({ where: { id } });
    if (!lease) throw new NotFoundException('Lease not found');
    const pct = Number(input.escalationPct ?? 0);
    const oldRent = Number(lease.rentAmount);
    const newRent = Math.round(oldRent * (1 + pct / 100));

    let newEnd = input.newEndDate;
    if (!newEnd && input.months) {
      const base = lease.endDate ? new Date(lease.endDate) : new Date();
      base.setMonth(base.getMonth() + Number(input.months));
      newEnd = base.toISOString().slice(0, 10);
    }
    const history = Array.isArray((lease.escalation as any)?.history) ? (lease.escalation as any).history : [];
    history.push({ at: new Date().toISOString().slice(0, 10), fromRent: oldRent, toRent: newRent, pct });

    lease.rentAmount = newRent as any;
    if (newEnd) lease.endDate = newEnd;
    lease.escalation = { history } as any;
    return repo.save(lease);
  }

  /** Create an active lease (used by the applicant funnel on approval). */
  createLease(input: CreateLeaseInput): Promise<Lease> {
    const repo = this.tenant.getRepository(Lease);
    return repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        unitId: input.unitId,
        tenantId: input.tenantId,
        type: input.type ?? 'fixed',
        status: 'active',
        startDate: input.startDate,
        endDate: input.endDate,
        rentAmount: input.rentAmount,
        billingCycle: input.billingCycle ?? 'monthly',
      }),
    );
  }
}
