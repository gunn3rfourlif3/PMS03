import { Injectable } from '@nestjs/common';
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
