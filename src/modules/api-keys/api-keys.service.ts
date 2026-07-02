import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { ApiKey } from './api-key.entity';
import { generateApiKey } from './api-key.util';

@Injectable()
export class ApiKeysService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Create a key for the current vendor. Returns the plaintext ONCE. */
  async create(name: string, scopes: string[] = [], expiresAt?: string) {
    const { plaintext, prefix, hash } = generateApiKey();
    const repo = this.tenant.getRepository(ApiKey);
    const rec = await repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        name,
        prefix,
        keyHash: hash,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      }),
    );
    return { id: rec.id, name: rec.name, prefix: rec.prefix, scopes: rec.scopes, apiKey: plaintext };
  }

  /** List keys (never returns the hash or plaintext). */
  list() {
    return this.tenant.getRepository(ApiKey).find({
      select: ['id', 'name', 'prefix', 'scopes', 'lastUsedAt', 'revokedAt', 'expiresAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string) {
    const repo = this.tenant.getRepository(ApiKey);
    const rec = await repo.findOne({ where: { id } });
    if (!rec) throw new NotFoundException('API key not found');
    rec.revokedAt = new Date();
    await repo.save(rec);
    return { id, revoked: true };
  }
}
