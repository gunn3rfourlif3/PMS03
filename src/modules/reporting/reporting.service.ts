import { Injectable } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { collectionRate } from './reporting-calc';

/**
 * Read-only management reports. All queries run through the request's RLS-scoped
 * EntityManager, so every figure is automatically limited to the caller's vendor.
 */
@Injectable()
export class ReportingService {
  constructor(private readonly tenant: TenantContextService) {}

  ping(): string {
    return 'Reporting module ready';
  }

  /** Active leases with unit, rent, and current outstanding balance. */
  rentRoll(): Promise<unknown[]> {
    return this.tenant.getManager().query(`
      SELECT l.id AS lease_id, u.label AS unit, l.tenant_id, l.rent_amount, l.status,
             COALESCE(SUM(CASE WHEN i.status <> 'paid' THEN i.total ELSE 0 END), 0) AS outstanding
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      LEFT JOIN invoices i ON i.lease_id = l.id
      WHERE l.status = 'active'
      GROUP BY l.id, u.label, l.tenant_id, l.rent_amount, l.status
      ORDER BY u.label;
    `);
  }

  /** Outstanding invoice value bucketed by days past due. */
  async arrearsAging(): Promise<Record<string, number>> {
    const rows = await this.tenant.getManager().query(`
      SELECT
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 0 AND 30  THEN total ELSE 0 END),0) AS "d0_30",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN total ELSE 0 END),0) AS "d31_60",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN total ELSE 0 END),0) AS "d61_90",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date > 90 THEN total ELSE 0 END),0) AS "d90_plus",
        COALESCE(SUM(total),0) AS "total_outstanding"
      FROM invoices
      WHERE status IN ('issued','partly_paid','overdue');
    `);
    const r = rows[0] ?? {};
    return {
      '0-30': Number(r.d0_30 ?? 0),
      '31-60': Number(r.d31_60 ?? 0),
      '61-90': Number(r.d61_90 ?? 0),
      '90+': Number(r.d90_plus ?? 0),
      total: Number(r.total_outstanding ?? 0),
    };
  }

  /** Billed vs collected for a 'YYYY-MM' period, with collection rate. */
  async collectionSummary(period: string): Promise<{
    period: string; billed: number; collected: number; collectionRate: number;
  }> {
    const rows = await this.tenant.getManager().query(
      `
      SELECT
        (SELECT COALESCE(SUM(total),0) FROM invoices WHERE period = $1) AS billed,
        (SELECT COALESCE(SUM(p.amount),0)
           FROM payments p
           JOIN invoices i ON i.id = (p.allocation->0->>'invoiceId')::uuid
          WHERE p.status = 'succeeded' AND i.period = $1) AS collected;
      `,
      [period],
    );
    const billed = Number(rows[0]?.billed ?? 0);
    const collected = Number(rows[0]?.collected ?? 0);
    return { period, billed, collected, collectionRate: collectionRate(billed, collected) };
  }
}
