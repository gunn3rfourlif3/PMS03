import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Unit, UnitStatus } from './unit.entity';
import { Property } from './property.entity';

/**
 * Reference implementation of the RLS-safe data pattern. Repositories are
 * resolved from TenantContextService (the per-request, transaction-scoped
 * EntityManager with app.current_vendor_id already SET), so every query runs
 * under RLS. vendorId is also stamped on writes as app-layer defence-in-depth.
 */
@Injectable()
export class PropertiesService {
  constructor(private readonly tenant: TenantContextService) {}

  ping(): string {
    return 'Properties module ready';
  }

  listUnits(): Promise<Unit[]> {
    return this.tenant.getRepository(Unit).find();
  }

  createProperty(data: Partial<Property>): Promise<Property> {
    const repo = this.tenant.getRepository(Property);
    const entity = repo.create({
      ...data,
      vendorId: this.tenant.vendorId ?? undefined,
    });
    return repo.save(entity);
  }

  /** Transition a unit's status (e.g. vacant -> occupied on lease approval). */
  async setUnitStatus(unitId: string, status: UnitStatus): Promise<Unit> {
    const repo = this.tenant.getRepository(Unit);
    const unit = await repo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    unit.status = status;
    return repo.save(unit);
  }
}
