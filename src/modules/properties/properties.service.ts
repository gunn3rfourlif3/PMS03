import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Unit, UnitStatus } from './unit.entity';
import { Property } from './property.entity';

/**
 * Properties + units CRUD. All reads/writes run through the RLS-scoped
 * EntityManager, and vendorId is stamped on writes (defence in depth).
 */
@Injectable()
export class PropertiesService {
  constructor(private readonly tenant: TenantContextService) {}

  ping(): string {
    return 'Properties module ready';
  }

  // ---- Properties ----
  listProperties(): Promise<unknown[]> {
    return this.tenant.getManager().query(`
      SELECT p.id, p.name, p.type, p.owner_id, p.address, o.name AS owner_name,
             COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL) AS unit_count,
             COUNT(u.id) FILTER (WHERE u.status = 'occupied' AND u.deleted_at IS NULL) AS occupied_count
      FROM properties p
      LEFT JOIN owners o ON o.id = p.owner_id
      LEFT JOIN units u ON u.property_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, o.name
      ORDER BY p.name;
    `);
  }

  createProperty(data: Partial<Property>): Promise<Property> {
    const repo = this.tenant.getRepository(Property);
    return repo.save(repo.create({ ...data, vendorId: this.tenant.vendorId ?? undefined }));
  }

  async updateProperty(id: string, data: Partial<Property>): Promise<Property> {
    const repo = this.tenant.getRepository(Property);
    const p = await repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Property not found');
    if (data.name !== undefined) p.name = data.name;
    if (data.type !== undefined) p.type = data.type;
    if (data.ownerId !== undefined) p.ownerId = data.ownerId || undefined;
    if (data.address !== undefined) p.address = data.address;
    return repo.save(p);
  }

  async removeProperty(id: string): Promise<{ id: string; deleted: true }> {
    const units = await this.tenant.getRepository(Unit).count({ where: { propertyId: id } });
    if (units > 0) throw new BadRequestException("Remove this property's units before deleting it.");
    await this.tenant.getRepository(Property).softDelete(id);
    return { id, deleted: true };
  }

  // ---- Units ----
  listUnits(propertyId?: string): Promise<Unit[]> {
    const repo = this.tenant.getRepository(Unit);
    return repo.find({ where: propertyId ? { propertyId } : {}, order: { label: 'ASC' } });
  }

  createUnit(data: Partial<Unit>): Promise<Unit> {
    const repo = this.tenant.getRepository(Unit);
    return repo.save(repo.create({
      ...data,
      vendorId: this.tenant.vendorId ?? undefined,
      status: (data.status as UnitStatus) ?? 'vacant',
    }));
  }

  async updateUnit(id: string, data: Partial<Unit>): Promise<Unit> {
    const repo = this.tenant.getRepository(Unit);
    const u = await repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Unit not found');
    if (data.label !== undefined) u.label = data.label;
    if (data.status !== undefined) u.status = data.status as UnitStatus;
    if (data.marketRent !== undefined) u.marketRent = data.marketRent;
    if (data.bedrooms !== undefined) u.bedrooms = data.bedrooms;
    if (data.bathrooms !== undefined) u.bathrooms = data.bathrooms;
    return repo.save(u);
  }

  async removeUnit(id: string): Promise<{ id: string; deleted: true }> {
    const active = await this.tenant.getManager().query(
      `SELECT 1 FROM leases WHERE unit_id = $1 AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (active.length) throw new BadRequestException('This unit has an active lease; end it before deleting.');
    await this.tenant.getRepository(Unit).softDelete(id);
    return { id, deleted: true };
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
