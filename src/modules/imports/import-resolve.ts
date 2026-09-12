import { EntityManager } from 'typeorm';
import { EntitySpec } from './import-fields';
import { ParsedRow, RowIssue } from './import-rows';

/**
 * Deciding what each row WOULD do, against what the agency already has.
 *
 * Runs inside the vendor's tenant context, so every query is RLS-scoped to that
 * agency — an importer that could see another agency's units would be a far
 * worse bug than anything it might fix.
 *
 * Nothing here writes. The output is the dry-run report: create, update, or
 * blocked, per row, with a reason.
 */

export type RowAction = 'create' | 'update' | 'blocked' | 'skip';

export interface ResolvedRow extends ParsedRow {
  action: RowAction;
  /** Existing record this row matched, when it is an update. */
  existingId?: string;
  /** What the row means in plain words, for the report. */
  summary: string;
}

export interface DryRunReport {
  entity: string;
  creates: number;
  updates: number;
  blocked: number;
  skipped: number;
  warnings: number;
  rows: ResolvedRow[];
  /** Set when the whole file cannot proceed, e.g. a missing parent import. */
  blockers: string[];
}

const lower = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** name -> id, for the agency's existing records of one kind. */
type Index = Map<string, string>;

async function indexBy(m: EntityManager, sql: string, params: unknown[] = []): Promise<Index> {
  const rows: Array<{ id: string; k: string }> = await m.query(sql, params);
  const out: Index = new Map();
  for (const r of rows) if (!out.has(lower(r.k))) out.set(lower(r.k), r.id);
  return out;
}

const err = (field: string, label: string, message: string): RowIssue =>
  ({ field, label, message, level: 'error' });

/**
 * Resolve a parsed sheet against the database.
 *
 * `m` must already be inside the vendor's tenant context.
 */
export async function resolveRows(
  m: EntityManager,
  spec: EntitySpec,
  rows: ParsedRow[],
): Promise<DryRunReport> {
  const blockers: string[] = [];
  const resolved: ResolvedRow[] = [];

  // Existing records, indexed once rather than queried per row: a 500-row file
  // would otherwise be 1,500 round trips.
  const owners = spec.entity === 'properties'
    ? await indexBy(m, `SELECT id, name AS k FROM owners WHERE deleted_at IS NULL`) : null;

  const properties = ['properties', 'units', 'leases', 'deposits', 'opening_balances'].includes(spec.entity)
    ? await indexBy(m, `SELECT id, name AS k FROM properties WHERE deleted_at IS NULL`) : null;

  const units = ['units', 'leases', 'deposits', 'opening_balances'].includes(spec.entity)
    ? await indexBy(m, `SELECT u.id, p.name || ' · ' || u.label AS k
                          FROM units u JOIN properties p ON p.id = u.property_id
                         WHERE u.deleted_at IS NULL AND p.deleted_at IS NULL`) : null;

  const ownersIdx = spec.entity === 'owners'
    ? await indexBy(m, `SELECT id, name AS k FROM owners WHERE deleted_at IS NULL`) : null;

  const tenantsIdx = spec.entity === 'tenants'
    ? await indexBy(m, `SELECT u.id, u.email AS k FROM users u
                          JOIN memberships mm ON mm.user_id = u.id
                         WHERE u.email IS NOT NULL`) : null;

  const leasesIdx = ['leases', 'deposits', 'opening_balances'].includes(spec.entity)
    ? await indexBy(m, `SELECT l.id, p.name || ' · ' || u.label AS k
                          FROM leases l
                          JOIN units u ON u.id = l.unit_id
                          JOIN properties p ON p.id = u.property_id
                         WHERE l.deleted_at IS NULL AND l.status <> 'ended'`) : null;

  if (properties && properties.size === 0 && spec.entity !== 'properties') {
    blockers.push('This agency has no properties yet. Import properties, then units, before this file.');
  }
  if (units && units.size === 0 && !['units', 'properties'].includes(spec.entity)) {
    blockers.push('This agency has no units yet. Import units before this file.');
  }

  for (const row of rows) {
    const issues = [...row.issues];
    const v = row.values;
    let existingId: string | undefined;
    let summary = '';

    // Parent references must resolve, or the row cannot be written.
    if (spec.entity === 'properties' && v.ownerName && owners && !owners.has(lower(v.ownerName))) {
      issues.push(err('ownerName', 'Owner name', `no owner called "${v.ownerName}" — import the owners file first, or correct the spelling`));
    }
    if (['units'].includes(spec.entity) && properties && v.propertyName && !properties.has(lower(v.propertyName))) {
      issues.push(err('propertyName', 'Property name', `no property called "${v.propertyName}" — import the properties file first`));
    }
    if (['leases', 'deposits', 'opening_balances'].includes(spec.entity) && units && v.propertyName && v.unitLabel) {
      const unitKey = `${lower(v.propertyName)} · ${lower(v.unitLabel)}`;
      if (!units.has(unitKey)) {
        issues.push(err('unitLabel', 'Unit number', `no unit "${v.unitLabel}" at "${v.propertyName}" — import the units file first`));
      }
    }
    if (['deposits', 'opening_balances'].includes(spec.entity) && leasesIdx && v.propertyName && v.unitLabel) {
      const leaseKey = `${lower(v.propertyName)} · ${lower(v.unitLabel)}`;
      if (!leasesIdx.has(leaseKey)) {
        issues.push(err('unitLabel', 'Unit number', `no active lease on "${v.unitLabel}" at "${v.propertyName}" — a deposit or balance needs a lease to attach to`));
      } else {
        existingId = leasesIdx.get(leaseKey);
      }
    }

    // Does this row already exist?
    if (row.key) {
      if (spec.entity === 'owners') existingId = ownersIdx?.get(row.key);
      else if (spec.entity === 'properties') existingId = properties?.get(row.key);
      else if (spec.entity === 'units') existingId = units?.get(row.key);
      else if (spec.entity === 'tenants') existingId = tenantsIdx?.get(row.key);
    }

    const hasError = issues.some((i) => i.level === 'error');
    const action: RowAction = hasError ? 'blocked'
      : spec.postsToLedger ? 'create'
        : existingId ? 'update' : 'create';

    summary = describe(spec.entity, v, action);
    resolved.push({ ...row, issues, action, existingId, summary });
  }

  return {
    entity: spec.entity,
    creates: resolved.filter((r) => r.action === 'create').length,
    updates: resolved.filter((r) => r.action === 'update').length,
    blocked: resolved.filter((r) => r.action === 'blocked').length,
    skipped: resolved.filter((r) => r.action === 'skip').length,
    warnings: resolved.filter((r) => r.issues.some((i) => i.level === 'warning')).length,
    rows: resolved,
    blockers,
  };
}

/** One line an operator can read without knowing the schema. */
function describe(entity: string, v: Record<string, unknown>, action: RowAction): string {
  const money = (n: unknown) => `R${Number(n ?? 0).toLocaleString('en-ZA')}`;
  switch (entity) {
    case 'owners': return `${v.name ?? '?'}`;
    case 'properties': return `${v.name ?? '?'}${v.ownerName ? ` (owner: ${v.ownerName})` : ''}`;
    case 'units': return `${v.propertyName ?? '?'} · unit ${v.label ?? '?'}`;
    case 'tenants': return `${v.name ?? '?'}${v.email ? ` <${v.email}>` : ''}`;
    case 'leases':
      return `${v.propertyName ?? '?'} · ${v.unitLabel ?? '?'} — ${v.tenantName ?? v.tenantEmail ?? 'tenant'}, ${money(v.rentAmount)}/month from ${v.startDate ?? '?'}`;
    case 'deposits':
      return `${v.propertyName ?? '?'} · ${v.unitLabel ?? '?'} — ${money(v.amount)} held by ${String(v.heldBy ?? '?').replace(/_/g, ' ')}`;
    case 'opening_balances':
      return `${v.propertyName ?? '?'} · ${v.unitLabel ?? '?'} — ${money(v.balance)} owing as at ${v.asAt ?? '?'}`;
    default: return action;
  }
}
