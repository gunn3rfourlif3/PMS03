import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

export interface TenantStore {
  vendorId: string | null; // null only for platform-admin / public routes
  userId: string | null;
  roles: string[];
  /** Transactional manager with app.current_vendor_id already SET (RLS active). */
  manager: EntityManager;
}

/**
 * Carries the per-request tenant + its RLS-scoped EntityManager via
 * AsyncLocalStorage, so any service deep in the call stack can obtain a
 * repository that is guaranteed to run inside the tenant transaction.
 *
 * Domain services MUST resolve repositories via getRepository(Entity) rather
 * than a plain @InjectRepository, otherwise queries run outside the RLS
 * transaction and the vendor GUC won't be set.
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, cb: () => Promise<T>): Promise<T> {
    return this.als.run(store, cb);
  }

  get(): TenantStore | undefined {
    return this.als.getStore();
  }

  get vendorId(): string | null {
    return this.als.getStore()?.vendorId ?? null;
  }

  getManager(): EntityManager {
    const store = this.als.getStore();
    if (!store) {
      throw new Error('No tenant context: request not wrapped by RlsInterceptor');
    }
    return store.manager;
  }

  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.getManager().getRepository(entity);
  }
}
