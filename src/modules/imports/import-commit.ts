import { EntityManager } from 'typeorm';
import { Owner } from '@modules/owners/owner.entity';
import { Property } from '@modules/properties/property.entity';
import { Unit } from '@modules/properties/unit.entity';
import { Lease } from '@modules/leasing/lease.entity';
import { User } from '@modules/identity/user.entity';
import { Membership } from '@modules/identity/membership.entity';
import { EntitySpec } from './import-fields';
import { ResolvedRow } from './import-resolve';

/**
 * Writing an import that has been checked and signed off.
 *
 * Every function here runs inside `runInVendorContext`, which is already a
 * transaction — so a failure anywhere rolls the whole file back. A half-written
 * portfolio is the one outcome worse than a rejected file, because nobody can
 * tell by looking which half arrived.
 *
 * Only the five reversible entities are written here. Deposits and opening
 * balances post to the immutable ledger and are a separate, slower path with a
 * signed schedule — `LOCARE_DATA_IMPORT_DESIGN.md` §5.
 */

export interface CommitResult {
  created: number;
  updated: number;
  skipped: number;
  /** Row numbers that were skipped because the check blocked them. */
  skippedRows: number[];
}

/** Assign only the keys whose value the sheet actually carried. */
function setIfGiven<T extends object>(target: T, patch: Partial<Record<keyof T, unknown>>): T {
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null && v !== '') (target as Record<string, unknown>)[k] = v;
  }
  return target;
}

const str = (v: unknown): string | undefined => {
  const s = String(v ?? '').trim();
  return s === '' ? undefined : s;
};
const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * A lease being imported describes a tenancy that already exists, so it is
 * written active rather than draft — that is the point of the migration, and a
 * draft lease bills nobody. One already past its end date comes in ended, so a
 * historical file cannot start invoicing people who moved out last year.
 */
export function leaseStatus(endDate: unknown, today = new Date()): 'active' | 'ended' {
  const end = str(endDate);
  if (!end) return 'active';
  const todayIso = today.toISOString().slice(0, 10);
  return end < todayIso ? 'ended' : 'active';
}

export async function commitRows(
  m: EntityManager,
  spec: EntitySpec,
  rows: ResolvedRow[],
  vendorId: string,
): Promise<CommitResult> {
  if (spec.postsToLedger) {
    // Belt and braces: the service refuses these before getting here.
    throw new Error(`${spec.label} posts to the ledger and is not committed by this path.`);
  }

  const result: CommitResult = { created: 0, updated: 0, skipped: 0, skippedRows: [] };

  for (const row of rows) {
    if (row.action === 'blocked' || row.action === 'skip') {
      result.skipped += 1;
      result.skippedRows.push(row.rowNumber);
      continue;
    }
    const wrote = await writeRow(m, spec, row, vendorId);
    if (wrote === 'created') result.created += 1;
    else result.updated += 1;
  }

  return result;
}

async function writeRow(
  m: EntityManager,
  spec: EntitySpec,
  row: ResolvedRow,
  vendorId: string,
): Promise<'created' | 'updated'> {
  const v = row.values;

  switch (spec.entity) {
    // ── Owners ────────────────────────────────────────────────────────────
    case 'owners': {
      const repo = m.getRepository(Owner);
      const existing = row.existingId ? await repo.findOne({ where: { id: row.existingId } }) : null;
      const o = existing ?? repo.create({ vendorId, name: String(v.name), contact: {}, managementFeePct: 0 });
      setIfGiven(o, { name: str(v.name), managementFeePct: num(v.managementFeePct) });
      // Merge contact rather than replace: a second file with only phones must
      // not erase the emails the first one brought.
      o.contact = { ...(o.contact ?? {}), ...clean({ email: str(v.email), phone: str(v.phone) }) };
      await repo.save(o);
      return existing ? 'updated' : 'created';
    }

    // ── Properties ────────────────────────────────────────────────────────
    case 'properties': {
      const repo = m.getRepository(Property);
      const existing = row.existingId ? await repo.findOne({ where: { id: row.existingId } }) : null;
      const ownerId = v.ownerName
        ? (await m.getRepository(Owner).findOne({ where: { name: String(v.ownerName).trim() } }))?.id
        : undefined;

      // `type` is not an import field. 'building' is the safe default: a
      // property here is a container for units, however many it turns out to
      // hold, and an operator can change it afterwards.
      const p = existing ?? repo.create({
        vendorId, name: String(v.name), type: 'building', address: {}, attributes: {},
      });
      setIfGiven(p, { name: str(v.name), ownerId });
      p.address = {
        ...(p.address ?? {}),
        ...clean({
          line: str(v.addressLine), suburb: str(v.suburb),
          city: str(v.city), postalCode: str(v.postalCode),
        }),
      };
      await repo.save(p);
      return existing ? 'updated' : 'created';
    }

    // ── Units ─────────────────────────────────────────────────────────────
    case 'units': {
      const repo = m.getRepository(Unit);
      const existing = row.existingId ? await repo.findOne({ where: { id: row.existingId } }) : null;
      const property = await m.getRepository(Property)
        .findOne({ where: { name: String(v.propertyName).trim() } });
      if (!property) throw new Error(`Row ${row.rowNumber}: property "${v.propertyName}" vanished between the check and the commit.`);

      const u = existing ?? repo.create({
        vendorId, propertyId: property.id, label: String(v.label), status: 'vacant',
        marketRent: 0, bedrooms: 0, bathrooms: 0, attributes: {},
      });
      setIfGiven(u, {
        label: str(v.label), propertyId: property.id,
        marketRent: num(v.marketRent), bedrooms: num(v.bedrooms), bathrooms: num(v.bathrooms),
      });
      await repo.save(u);
      return existing ? 'updated' : 'created';
    }

    // ── Tenants: a user, plus their membership of this agency ─────────────
    case 'tenants': {
      const users = m.getRepository(User);
      const email = str(v.email)?.toLowerCase();
      // Users are platform-wide, so match on email across the table; the
      // membership below is what ties them to THIS agency.
      const existing = email ? await users.findOne({ where: { email } }) : null;
      const u = existing ?? users.create({ status: 'active' });
      setIfGiven(u, { name: str(v.name), email, phone: str(v.phone) });
      await users.save(u);

      const memberships = m.getRepository(Membership);
      const has = await memberships.findOne({ where: { vendorId, userId: u.id } });
      if (!has) {
        await memberships.save(memberships.create({
          vendorId, userId: u.id, role: 'tenant', status: 'active', scope: {},
        }));
      }
      return existing ? 'updated' : 'created';
    }

    // ── Leases ────────────────────────────────────────────────────────────
    case 'leases': {
      const repo = m.getRepository(Lease);
      const existing = row.existingId ? await repo.findOne({ where: { id: row.existingId } }) : null;

      const unit = await m.getRepository(Unit).createQueryBuilder('u')
        .innerJoin(Property, 'p', 'p.id = u.property_id')
        .where('lower(p.name) = lower(:p)', { p: String(v.propertyName).trim() })
        .andWhere('lower(u.label) = lower(:l)', { l: String(v.unitLabel).trim() })
        .getOne();
      if (!unit) throw new Error(`Row ${row.rowNumber}: unit "${v.unitLabel}" at "${v.propertyName}" vanished between the check and the commit.`);

      const l = existing ?? repo.create({
        vendorId, unitId: unit.id, type: 'fixed', status: 'active',
        startDate: String(v.startDate), rentAmount: Number(v.rentAmount ?? 0),
        billingCycle: 'monthly', escalation: {},
      });
      setIfGiven(l, {
        unitId: unit.id,
        // Resolved during the check, so the commit cannot pick a different
        // tenant from the one the operator was shown.
        tenantId: row.tenantId,
        type: str(v.type),
        startDate: str(v.startDate),
        endDate: str(v.endDate),
        rentAmount: num(v.rentAmount),
      });
      l.status = leaseStatus(v.endDate);
      const esc = clean({ pct: num(v.escalationPct), month: num(v.escalationMonth) });
      if (Object.keys(esc).length) l.escalation = { ...(l.escalation ?? {}), ...esc };
      await repo.save(l);

      // An occupied unit should say so, or the vacancy figures are wrong from
      // day one and every report built on them is quietly off.
      if (l.status === 'active' && unit.status === 'vacant') {
        unit.status = 'occupied';
        await m.getRepository(Unit).save(unit);
      }
      return existing ? 'updated' : 'created';
    }

    default:
      throw new Error(`No commit path for ${spec.entity}.`);
  }
}

/** Drop undefined keys so a spread cannot write them over existing values. */
function clean(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
