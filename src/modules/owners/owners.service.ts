import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Owner } from './owner.entity';

@Injectable()
export class OwnersService {
  constructor(private readonly tenant: TenantContextService) {}

  create(data: Partial<Owner>): Promise<Owner> {
    const repo = this.tenant.getRepository(Owner);
    return repo.save(repo.create({ ...data, vendorId: this.tenant.vendorId ?? undefined }));
  }

  async get(id: string): Promise<Owner> {
    const owner = await this.tenant.getRepository(Owner).findOne({ where: { id } });
    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  async updateBanking(id: string, banking: Record<string, unknown>): Promise<Owner> {
    const repo = this.tenant.getRepository(Owner);
    const owner = await repo.findOne({ where: { id } });
    if (!owner) throw new NotFoundException('Owner not found');
    owner.banking = { ...(owner.banking ?? {}), ...banking };
    return repo.save(owner);
  }

  list(): Promise<Owner[]> {
    return this.tenant.getRepository(Owner).find({ order: { createdAt: 'DESC' } });
  }
}
