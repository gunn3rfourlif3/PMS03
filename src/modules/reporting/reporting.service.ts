import { Injectable } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { collectionRate } from './reporting-calc';
import {
  PortfolioUnit,
  PortfolioUnitRow,
  PortfolioSummary,
  deriveUnitState,
  summarisePortfolio,
} from './portfolio-state';

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

  /**
   * Outstanding invoice value split into "not yet due" plus days-past-due
   * buckets. The buckets always reconcile to the total:
   *   notYetDue + 0-30 + 31-60 + 61-90 + 90+ = total (outstanding)
   * True arrears (money actually late) = total - notYetDue.
   */
  async arrearsAging(): Promise<Record<string, number>> {
    const rows = await this.tenant.getManager().query(`
      SELECT
        COALESCE(SUM(CASE WHEN due_date > CURRENT_DATE THEN total ELSE 0 END),0) AS "not_due",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 0 AND 30  THEN total ELSE 0 END),0) AS "d0_30",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN total ELSE 0 END),0) AS "d31_60",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN total ELSE 0 END),0) AS "d61_90",
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date > 90 THEN total ELSE 0 END),0) AS "d90_plus",
        COALESCE(SUM(total),0) AS "total_outstanding"
      FROM invoices
      WHERE status IN ('issued','partly_paid','overdue');
    `);
    const r = rows[0] ?? {};
    const notYetDue = Number(r.not_due ?? 0);
    const total = Number(r.total_outstanding ?? 0);
    return {
      notYetDue,
      '0-30': Number(r.d0_30 ?? 0),
      '31-60': Number(r.d31_60 ?? 0),
      '61-90': Number(r.d61_90 ?? 0),
      '90+': Number(r.d90_plus ?? 0),
      arrears: total - notYetDue,
      total,
    };
  }

  /**
   * Period income statement (cash basis): rent collected in the period, less
   * expenses incurred, plus management-fee income earned on owner statements.
   */
  async incomeStatement(period: string): Promise<{
    period: string; rentCollected: number; managementFees: number; expenses: number; netOperating: number;
  }> {
    const rows = await this.tenant.getManager().query(
      `
      SELECT
        (SELECT COALESCE(SUM(p.amount),0)
           FROM payments p
           JOIN invoices i ON i.id = (p.allocation->0->>'invoiceId')::uuid
          WHERE p.status = 'succeeded' AND i.period = $1) AS rent_collected,
        (SELECT COALESCE(SUM(management_fee),0) FROM owner_statements WHERE period = $1) AS mgmt_fees,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE to_char(incurred_on,'YYYY-MM') = $1) AS expenses;
      `,
      [period],
    );
    const r = rows[0] ?? {};
    const rentCollected = Number(r.rent_collected ?? 0);
    const managementFees = Number(r.mgmt_fees ?? 0);
    const expenses = Number(r.expenses ?? 0);
    return { period, rentCollected, managementFees, expenses, netOperating: rentCollected + managementFees - expenses };
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

  /**
   * One row per unit with everything the god's-eye view paints: occupancy, the
   * live lease, arrears age, open tickets and the last completed inspection.
   *
   * RLS scopes this to the caller's agency, so the result is one agency's whole
   * portfolio — there is no cross-vendor variant by design.
   *
   * `outstanding` sums the TOTAL of unpaid invoices, which overstates a
   * `partly_paid` one. That matches `arrearsAging()` and `rentRoll()`
   * deliberately: three reports agreeing on a known simplification beats one
   * of them quietly disagreeing. Fixing it properly means allocating payments
   * against invoices, which is a change to all three at once.
   *
   * `today` is resolved once here and passed into the pure deriver so every
   * unit in one response is judged against the same date.
   */
  async portfolioState(
    today?: string,
  ): Promise<{ asOf: string; summary: PortfolioSummary; units: PortfolioUnit[] }> {
    const asOf = today ?? new Date().toISOString().slice(0, 10);

    const rows: Record<string, unknown>[] = await this.tenant.getManager().query(`
      SELECT
        u.id                          AS "unitId",
        u.property_id                 AS "propertyId",
        p.name                        AS "propertyName",
        u.label                       AS "label",
        u.status                      AS "unitStatus",
        l.id                          AS "leaseId",
        l.status                      AS "leaseStatus",
        to_char(l.end_date, 'YYYY-MM-DD')          AS "leaseEndDate",
        l.tenant_id                   AS "tenantId",
        COALESCE(l.rent_amount, 0)    AS "rentAmount",
        COALESCE(inv.outstanding, 0)  AS "outstanding",
        COALESCE(inv.max_days_overdue, 0)          AS "maxDaysOverdue",
        COALESCE(tk.open_tickets, 0)  AS "openTickets",
        COALESCE(tk.urgent_tickets, 0)             AS "urgentTickets",
        to_char(insp.last_inspection_on, 'YYYY-MM-DD') AS "lastInspectionOn"
      FROM units u
      JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT l2.id, l2.status, l2.end_date, l2.tenant_id, l2.rent_amount
          FROM leases l2
         WHERE l2.unit_id = u.id
           AND l2.deleted_at IS NULL
           AND l2.status IN ('active', 'ending')
         ORDER BY l2.start_date DESC
         LIMIT 1
      ) l ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.total), 0) AS outstanding,
               COALESCE(MAX(GREATEST(CURRENT_DATE - i.due_date, 0)), 0) AS max_days_overdue
          FROM invoices i
         WHERE i.lease_id = l.id
           AND i.status IN ('issued', 'partly_paid', 'overdue')
      ) inv ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE t.status IN ('open', 'assigned')) AS open_tickets,
               COUNT(*) FILTER (WHERE t.status IN ('open', 'assigned')
                                  AND t.priority = 'urgent')           AS urgent_tickets
          FROM tickets t
         WHERE t.unit_id = u.id
           AND t.deleted_at IS NULL
      ) tk ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(i2.conducted_on) AS last_inspection_on
          FROM inspections i2
         WHERE i2.unit_id = u.id
           AND i2.deleted_at IS NULL
           AND i2.status IN ('completed', 'signed_off')
      ) insp ON TRUE
      WHERE u.deleted_at IS NULL
      ORDER BY p.name, u.label;
    `);

    // pg returns numeric columns as strings; coerce before the pure deriver so
    // the rules never compare a string to a number.
    const units = rows.map((r) =>
      deriveUnitState(
        {
          unitId: String(r.unitId),
          propertyId: String(r.propertyId),
          propertyName: String(r.propertyName ?? ''),
          label: String(r.label ?? ''),
          unitStatus: String(r.unitStatus ?? 'vacant'),
          leaseId: (r.leaseId as string | null) ?? null,
          leaseStatus: (r.leaseStatus as string | null) ?? null,
          leaseEndDate: (r.leaseEndDate as string | null) ?? null,
          tenantId: (r.tenantId as string | null) ?? null,
          rentAmount: Number(r.rentAmount ?? 0),
          outstanding: Number(r.outstanding ?? 0),
          maxDaysOverdue: Number(r.maxDaysOverdue ?? 0),
          openTickets: Number(r.openTickets ?? 0),
          urgentTickets: Number(r.urgentTickets ?? 0),
          lastInspectionOn: (r.lastInspectionOn as string | null) ?? null,
        } satisfies PortfolioUnitRow,
        asOf,
      ),
    );

    return { asOf, summary: summarisePortfolio(units), units };
  }
}
