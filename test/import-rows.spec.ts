import { parseRows, rowKey } from '../src/modules/imports/import-rows';
import { entitySpec, suggestMapping } from '../src/modules/imports/import-fields';

const leases = entitySpec('leases');
const tenants = entitySpec('tenants');

const LEASE_HEADERS = ['Building', 'Unit No.', 'Tenant', 'Commencement', 'Expiry', 'Rental', 'Escalation %'];
const leaseMap = () => {
  const m = suggestMapping(LEASE_HEADERS, leases);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [String(k), v]));
};

const errorsOn = (r: { issues: { level: string; message: string }[] }) =>
  r.issues.filter((i) => i.level === 'error').map((i) => i.message);

describe('row parsing', () => {
  it('numbers rows the way Excel does, so a report can be acted on', () => {
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', '2026-03-01', '2027-02-28', 9500, 7],
    ]);
    // Header is row 1, so the first data row is row 2.
    expect(out.rows[0].rowNumber).toBe(2);
    expect(out.rows[0].issues).toHaveLength(0);
    expect(out.rows[0].values).toMatchObject({
      propertyName: 'Grove Court', unitLabel: '007', rentAmount: 9500, startDate: '2026-03-01',
    });
  });

  it('ignores blank rows instead of reporting them', () => {
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', '2026-03-01', '', 9500, ''],
      ['', '', '', '', '', '', ''],
      [null, null, null, null, null, null, null],
    ]);
    expect(out.rows).toHaveLength(1);
    expect(out.skippedBlank).toBe(2);
  });

  it('says when a required field has no column mapped at all', () => {
    const partial = { '0': 'propertyName', '1': 'unitLabel' };
    const out = parseRows(leases, partial, [['Grove Court', '007', '', '', '', '', '']]);
    expect(errorsOn(out.rows[0]).join(' ')).toMatch(/no column is mapped to it/);
  });

  it('reports the ambiguous date against its own column', () => {
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', '03/04/2026', '', 9500, ''],
    ]);
    const issue = out.rows[0].issues.find((i) => i.field === 'startDate')!;
    expect(issue.label).toBe('Start date');
    expect(issue.message).toMatch(/ambiguous/);
  });

  it('catches a lease that ends before it starts', () => {
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', '2026-03-01', '2025-02-28', 9500, ''],
    ]);
    expect(errorsOn(out.rows[0]).join(' ')).toMatch(/ends \(2025-02-28\) before it starts/);
  });

  it('warns when a percentage was entered as a fraction', () => {
    // 0.07 is the mistake that silently under-escalates every lease for a year.
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', '2026-03-01', '', 9500, 0.07],
    ]);
    const warn = out.rows[0].issues.find((i) => i.level === 'warning')!;
    expect(warn.message).toMatch(/looks like a fraction/);
    expect(out.errorCount).toBe(0);       // a warning must not block the import
    expect(out.warningCount).toBe(1);
  });

  it('refuses two rows describing the same unit', () => {
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', '2026-03-01', '', 9500, ''],
      ['grove court', '007', 'Someone', '2026-03-01', '', 9900, ''],
    ]);
    expect(errorsOn(out.rows[1]).join(' ')).toMatch(/duplicates row 2/);
    expect(out.errorCount).toBe(1);
  });

  it('does not run cross-field rules on a row that already failed', () => {
    // Otherwise one bad cell produces a cascade of consequential complaints and
    // the operator cannot see what actually needs fixing.
    const out = parseRows(leases, leaseMap(), [
      ['Grove Court', '007', 'Thandi', 'not a date', 'also not', 'not money', ''],
    ]);
    expect(errorsOn(out.rows[0]).every((m) => /not a date|not an amount/.test(m))).toBe(true);
  });

  it('insists a tenant can actually be contacted', () => {
    const map = { '0': 'name', '1': 'email', '2': 'phone' };
    const out = parseRows(tenants, map, [
      ['Thandi Mokoena', '', ''],
      ['Riaan de Villiers', '', '0821234567'],
    ]);
    expect(errorsOn(out.rows[0]).join(' ')).toMatch(/no way to reach this one/);
    expect(out.rows[1].issues).toHaveLength(0);
    expect(out.rows[1].values.phone).toBe('+27821234567');
  });
});

describe('natural keys', () => {
  it('is case and space insensitive, so a re-upload matches', () => {
    expect(rowKey(leases, { propertyName: ' Grove  Court ', unitLabel: '007', startDate: '2026-03-01' }))
      .toBe(rowKey(leases, { propertyName: 'grove  court', unitLabel: '007', startDate: '2026-03-01' }));
  });

  it('is null when a key part is missing, so nothing matches by accident', () => {
    expect(rowKey(leases, { propertyName: 'Grove Court', unitLabel: '007' })).toBeNull();
  });
});
