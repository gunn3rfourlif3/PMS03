import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Owner } from './owner.entity';

/**
 * Owner-facing portal. Every method resolves the Owner record from the logged-in
 * user (owners.user_id) and only ever returns that owner's own data. RLS keeps
 * it inside the vendor; the owner_id filter keeps it to this owner.
 */
@Injectable()
export class PortalService {
  constructor(private readonly tenant: TenantContextService) {}

  private async ownerFor(userId: string): Promise<Owner> {
    const owner = await this.tenant.getRepository(Owner).findOne({ where: { userId } });
    if (!owner) throw new ForbiddenException('No owner profile is linked to this account.');
    return owner;
  }

  async me(userId: string) {
    const o = await this.ownerFor(userId);
    return { id: o.id, name: o.name, managementFeePct: Number(o.managementFeePct), banking: o.banking ?? {} };
  }

  /** Portfolio properties with unit + occupancy + rent-roll rollups. */
  async properties(userId: string): Promise<unknown[]> {
    const o = await this.ownerFor(userId);
    return this.tenant.getManager().query(`
      SELECT p.id, p.name, p.type,
             COUNT(u.id)::int AS "units",
             COUNT(u.id) FILTER (WHERE u.status = 'occupied')::int AS "occupied",
             COALESCE(SUM(u.market_rent) FILTER (WHERE u.status = 'occupied'), 0) AS "monthlyRent"
      FROM properties p
      LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
      WHERE p.owner_id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.type
      ORDER BY p.name ASC;
    `, [o.id]);
  }

  /** Statements newest-first, each with its payout (if any). */
  async statements(userId: string): Promise<unknown[]> {
    const o = await this.ownerFor(userId);
    return this.tenant.getManager().query(`
      SELECT s.id, s.period, s.gross_collected AS "grossCollected", s.management_fee AS "managementFee",
             s.expenses, s.net_payout AS "netPayout", s.status, s.created_at AS "createdAt",
             po.status AS "payoutStatus", po.created_at AS "paidAt", po.gateway_ref AS "payoutRef"
      FROM owner_statements s
      LEFT JOIN payouts po ON po.statement_id = s.id
      WHERE s.owner_id = $1
      ORDER BY s.period DESC;
    `, [o.id]);
  }

  /** Headline numbers for the portal overview. */
  async summary(userId: string) {
    const o = await this.ownerFor(userId);
    const m = this.tenant.getManager();
    const [props] = await m.query(`
      SELECT COUNT(DISTINCT p.id)::int AS "properties",
             COUNT(u.id)::int AS "units",
             COUNT(u.id) FILTER (WHERE u.status = 'occupied')::int AS "occupied",
             COALESCE(SUM(u.market_rent) FILTER (WHERE u.status = 'occupied'), 0) AS "monthlyRent"
      FROM properties p
      LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
      WHERE p.owner_id = $1 AND p.deleted_at IS NULL;`, [o.id]);
    const [totals] = await m.query(`
      SELECT COALESCE(SUM(net_payout) FILTER (WHERE status = 'paid_out'), 0) AS "paidToDate",
             COALESCE(SUM(net_payout) FILTER (WHERE status = 'finalized'), 0) AS "pendingPayout"
      FROM owner_statements WHERE owner_id = $1;`, [o.id]);
    const [latest] = await m.query(`
      SELECT period, net_payout AS "netPayout", status
      FROM owner_statements WHERE owner_id = $1 ORDER BY period DESC LIMIT 1;`, [o.id]);
    const units = Number(props?.units ?? 0);
    const occupied = Number(props?.occupied ?? 0);
    return {
      name: o.name,
      properties: Number(props?.properties ?? 0),
      units, occupied,
      occupancyPct: units ? Math.round((occupied / units) * 100) : 0,
      monthlyRent: Number(props?.monthlyRent ?? 0),
      paidToDate: Number(totals?.paidToDate ?? 0),
      pendingPayout: Number(totals?.pendingPayout ?? 0),
      bankingOnFile: !!(o.banking && (o.banking as any).accountNumber),
      latestStatement: latest ?? null,
    };
  }

  async getBanking(userId: string) {
    const o = await this.ownerFor(userId);
    return o.banking ?? {};
  }

  async updateBanking(userId: string, banking: Record<string, unknown>) {
    const repo = this.tenant.getRepository(Owner);
    const o = await this.ownerFor(userId);
    o.banking = { ...(o.banking ?? {}), ...banking };
    await repo.save(o);
    return o.banking;
  }
}
