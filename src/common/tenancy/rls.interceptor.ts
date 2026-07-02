import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable, from, lastValueFrom } from 'rxjs';
import { TenantContextService, TenantStore } from './tenant-context.service';

/**
 * Wraps every request in a DB transaction and sets the tenant GUC so Postgres
 * Row-Level Security applies:
 *
 *     SELECT set_config('app.current_vendor_id', <vendorId>, true)   -- true = LOCAL
 *
 * The transactional EntityManager is stashed in AsyncLocalStorage so downstream
 * services run their queries inside this same tenant-scoped transaction.
 *
 * This is the DB-enforced isolation. The app-layer scope (guards/queries that
 * also filter by vendorId) is the belt-and-suspenders second layer.
 *
 * Perf note: wrapping reads in a transaction is the price of correct RLS here.
 * A future optimization is a read-only fast path; keep correctness first.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    // Populated by JwtStrategy (req.user) or dev TenantMiddleware (req.tenant).
    const principal = req.user ?? req.tenant ?? {};
    const vendorId: string | null = principal.vendorId ?? null;
    const userId: string | null = principal.userId ?? principal.sub ?? null;
    const roles: string[] = principal.roles ?? [];

    return from(
      this.dataSource.transaction(async (manager) => {
        // set_config(..., true) => scoped to THIS transaction only.
        await manager.query(
          `SELECT set_config('app.current_vendor_id', $1, true)`,
          [vendorId ?? ''],
        );
        const store: TenantStore = { vendorId, userId, roles, manager };
        return this.tenantContext.run(store, () => lastValueFrom(next.handle()));
      }),
    );
  }
}
