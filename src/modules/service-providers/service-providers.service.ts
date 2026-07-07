import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { ServiceProvider } from './service-provider.entity';

@Injectable()
export class ServiceProvidersService {
  constructor(private readonly tenant: TenantContextService) {}

  list(category?: string): Promise<ServiceProvider[]> {
    const repo = this.tenant.getRepository(ServiceProvider);
    return repo.find({ where: category ? { category } : {}, order: { name: 'ASC' } });
  }

  create(data: Partial<ServiceProvider>): Promise<ServiceProvider> {
    const repo = this.tenant.getRepository(ServiceProvider);
    return repo.save(repo.create({ ...data, vendorId: this.tenant.vendorId ?? undefined, status: 'active' }));
  }

  async update(id: string, data: Partial<ServiceProvider>): Promise<ServiceProvider> {
    const repo = this.tenant.getRepository(ServiceProvider);
    const p = await repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Service provider not found');
    Object.assign(p, data);
    return repo.save(p);
  }

  async setStatus(id: string, status: string): Promise<ServiceProvider> {
    return this.update(id, { status });
  }
}
