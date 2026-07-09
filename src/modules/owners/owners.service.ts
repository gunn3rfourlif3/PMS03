import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Owner } from './owner.entity';
import { maskBanking } from '@common/security/pii-crypto';

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

  /** Owner directory. Account numbers are masked here — full details are only
   *  returned by getBanking() on an explicit, manager-gated request. */
  async list(): Promise<Owner[]> {
    const owners = await this.tenant.getRepository(Owner).find({ order: { createdAt: 'DESC' } });
    return owners.map((o) => ({ ...o, banking: maskBanking(o.banking as any) })) as unknown as Owner[];
  }

  /** Full (unmasked) banking for a single owner — for the banking editor. */
  async getBanking(id: string): Promise<Record<string, unknown>> {
    const owner = await this.get(id);
    return owner.banking ?? {};
  }
}
