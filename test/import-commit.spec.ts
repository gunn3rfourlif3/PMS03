import { EntityManager } from 'typeorm';
import { leaseStatus, commitRows } from '../src/modules/imports/import-commit';
import { resolveRows } from '../src/modules/imports/import-resolve';
import { entitySpec } from '../src/modules/imports/import-fields';
import { ParsedRow } from '../src/modules/imports/import-rows';

/**
 * A stand-in EntityManager. `resolveRows` only ever calls `query`, so the whole
 * resolution path is testable without Postgres — which matters, because these
 * are the checks that decide whether a row is written at all.
 */
function fakeManager(data: {
  owners?: string[]; properties?: string[]; units?: string[];
  leases?: string[]; leaseKeys?: string[];
  tenantEmails?: string[]; tenantNames?: string[];
}): EntityManager {
  const idx = (names: string[] = []) => names.map((k, i) => ({ id: `id-${k}-${i}`, k }));
  return {
    query: async (sql: string) => {
      if (sql.includes('FROM owners')) return idx(data.owners);
      if (sql.includes('FROM properties')) return idx(data.properties);
      if (sql.includes('FROM units u JOIN properties')) return idx(data.units);
      if (sql.includes('FROM leases l') && sql.includes('to_char')) return idx(data.leaseKeys);
      if (sql.includes('FROM leases l')) return idx(data.leases);
      if (sql.includes('FROM users u') && sql.includes('u.email AS k')) return idx(data.tenantEmails);
      if (sql.includes('FROM users u') && sql.includes('u.name AS k')) return idx(data.tenantNames);
      return [];
    },
  } as unknown as EntityManager;
}

const leaseRow = (values: Record<string, unknown>, rowNumber = 2): ParsedRow => ({
  rowNumber,
  values,
  key: [values.propertyName, values.unitLabel, values.startDate]
    .map((v) => String(v ?? '').toLowerCase()).join(' · '),
  issues: [],
});

const LEASE = {
  propertyName: 'Grove Court',
  unitLabel: '007',
  tenantEmail: 'thandi@example.co.za',
  startDate: '2026-03-01',
  rentAmount: 9500,
};

describe('a lease imported without its tenant', () => {
  const spec = entitySpec('leases');
  const world = {
    properties: ['Grove Court'],
    units: ['Grove Court · 007'],
    leases: ['Grove Court · 007'],
  };

  it('is blocked, not written with nobody attached', async () => {
    // Left unchecked this produced a lease that bills nobody — invisible until
    // the first rent run comes up short.
    const r = await resolveRows(fakeManager(world), spec, [leaseRow(LEASE)]);
    expect(r.blocked).toBe(1);
    expect(r.rows[0].issues.map((i) => i.message).join(' ')).toMatch(/no tenant .* import the tenants file first/);
  });

  it('resolves by email, and carries the id so the commit cannot pick another', async () => {
    const m = fakeManager({ ...world, tenantEmails: ['thandi@example.co.za'] });
    const r = await resolveRows(m, spec, [leaseRow(LEASE)]);
    expect(r.blocked).toBe(0);
    expect(r.rows[0].tenantId).toBeTruthy();
  });

  it('falls back to the name when the sheet has no email', async () => {
    const m = fakeManager({ ...world, tenantNames: ['Thandi Mokoena'] });
    const row = leaseRow({ ...LEASE, tenantEmail: undefined, tenantName: 'Thandi Mokoena' });
    const r = await resolveRows(m, spec, [row]);
    expect(r.blocked).toBe(0);
    expect(r.rows[0].tenantId).toBeTruthy();
  });

  it('is blocked when the sheet names no tenant at all', async () => {
    const row = leaseRow({ ...LEASE, tenantEmail: undefined });
    const r = await resolveRows(fakeManager(world), spec, [row]);
    expect(r.blocked).toBe(1);
    expect(r.rows[0].issues.map((i) => i.message).join(' ')).toMatch(/a lease needs a tenant/);
  });
});

describe('re-uploading the same leases file', () => {
  const spec = entitySpec('leases');

  it('updates rather than creating a second copy of every lease', async () => {
    // The natural key includes the start date, so one unit can hold a history
    // of leases while a re-upload still matches the right one.
    const m = fakeManager({
      properties: ['Grove Court'],
      units: ['Grove Court · 007'],
      leases: ['Grove Court · 007'],
      leaseKeys: ['Grove Court · 007 · 2026-03-01'],
      tenantEmails: ['thandi@example.co.za'],
    });
    const r = await resolveRows(m, spec, [leaseRow(LEASE)]);
    expect(r.updates).toBe(1);
    expect(r.creates).toBe(0);
  });

  it('treats a different start date on the same unit as a new lease', async () => {
    const m = fakeManager({
      properties: ['Grove Court'],
      units: ['Grove Court · 007'],
      leases: ['Grove Court · 007'],
      leaseKeys: ['Grove Court · 007 · 2025-03-01'],
      tenantEmails: ['thandi@example.co.za'],
    });
    const r = await resolveRows(m, spec, [leaseRow(LEASE)]);
    expect(r.creates).toBe(1);
    expect(r.updates).toBe(0);
  });
});

describe('what status an imported lease lands in', () => {
  const today = new Date('2026-09-16T00:00:00Z');

  it('is active, because an imported lease is a tenancy that already exists', () => {
    // A draft lease bills nobody, which defeats the whole migration.
    expect(leaseStatus(undefined, today)).toBe('active');
    expect(leaseStatus('2027-02-28', today)).toBe('active');
  });

  it('is ended when it already expired, so old rows cannot start invoicing', () => {
    expect(leaseStatus('2026-09-15', today)).toBe('ended');
    expect(leaseStatus('2019-01-31', today)).toBe('ended');
  });

  it('treats the last day as still running', () => {
    expect(leaseStatus('2026-09-16', today)).toBe('active');
  });
});

describe('the ledger entities', () => {
  it('refuse to be written by this path', async () => {
    // Deposits and opening balances post to an append-only ledger and need the
    // signed schedule. A generic commit path must never reach them.
    for (const e of ['deposits', 'opening_balances'] as const) {
      await expect(
        commitRows({} as EntityManager, entitySpec(e), [], 'vendor-1'),
      ).rejects.toThrow(/not committed by this path/);
    }
  });
});
