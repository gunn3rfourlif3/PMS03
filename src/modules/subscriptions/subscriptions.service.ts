import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { VendorSubscription } from './vendor-subscription.entity';
import { tierForUnits } from './subscription-calc';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly tenant: TenantContextService,
  ) {}

  /** vendor_subscriptions is a platform table (no RLS) — use the root manager. */
  private repo() { return this.ds.getRepository(VendorSubscription); }

  /**
   * The caller's own live plan. Counts the vendor's active units within its RLS
   * context, recomputes the tier/MRR (unless Enterprise), and persists a snapshot.
   */
  async mine(vendorId: string): Promise<VendorSubscription> {
    const [row] = await this.tenant.getManager().query(
      `SELECT COUNT(*)::int AS n FROM units WHERE deleted_at IS NULL`,
    );
    return this.refresh(vendorId, Number(row?.n) || 0);
  }

  /**
   * Upsert + resize a vendor's subscription from a unit count. Enterprise plans
   * keep their manually-set tier/MRR; everyone else is priced by the ladder.
   */
  async refresh(vendorId: string, unitCount: number): Promise<VendorSubscription> {
    const repo = this.repo();
    let sub = await repo.findOne({ where: { vendorId } });
    if (!sub) sub = repo.create({ vendorId, tier: 'starter', status: 'active' });
    sub.unitCount = unitCount;
    sub.currentPeriod = new Date().toISOString().slice(0, 7);
    // `mrr` always tracks the ladder, even for an agency on a negotiated price.
    // The override is applied at billing time (see effectivePrice), so the tier
    // and its list price stay honest in the back-office and in the commission
    // basis while the customer is still billed what they were promised.
    if (sub.tier !== 'enterprise') {
      const r = tierForUnits(unitCount);
      sub.tier = r.tier;
      sub.mrr = r.mrr;
    }
    return repo.save(sub);
  }
}
