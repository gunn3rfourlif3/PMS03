import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService, TenantStore } from './tenant-context.service';

/**
 * Runs work inside a tenant-scoped transaction OUTSIDE an HTTP request —
 * i.e. from BullMQ processors, cron jobs, or scripts, which have no
 * RlsInterceptor to establish context. Mirrors the interceptor: opens a
 * transaction, sets app.current_vendor_id, and puts the manager in ALS so the
 * same RLS-safe services work unchanged inside jobs.
 */
@Injectable()
export class TenantRunner {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  runInVendorContext<T>(vendorId: string, cb: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.current_vendor_id', $1, true)`,
        [vendorId],
      );
      const store: TenantStore = {
        vendorId,
        userId: null,
        roles: ['system'],
        manager,
      };
      return this.tenantContext.run(store, cb);
    });
  }
}
