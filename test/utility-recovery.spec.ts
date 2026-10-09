import { buildRecoveryLines, RecoverableReading } from '../src/modules/utilities/utility-recovery';

const r = (p: Partial<RecoverableReading>): RecoverableReading => ({
  id: 'r1', meterId: 'm1', unitId: 'u1', kind: 'electricity',
  readingDate: '2026-09-28', consumption: 250, cost: 687.5, estimated: false, ...p,
});

describe('recovery at actual cost', () => {
  it('charges exactly what the reading cost', () => {
    const out = buildRecoveryLines([r({})], '2026-09');
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0].amount).toBe(687.5);
    expect(out.total).toBe(687.5);
  });

  it('groups several readings of one utility into a single line', () => {
    const out = buildRecoveryLines([
      r({ id: 'a', cost: 100 }), r({ id: 'b', cost: 50 }),
    ], '2026-09');
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0].amount).toBe(150);
    expect(out.lines[0].readingIds).toEqual(['a', 'b']);
  });

  it('keeps utilities on separate lines, in a stable order', () => {
    const out = buildRecoveryLines([
      r({ id: 'w', kind: 'water', cost: 200 }),
      r({ id: 'e', kind: 'electricity', cost: 100 }),
    ], '2026-09');
    expect(out.lines.map((l) => l.description)).toEqual(['Electricity 2026-09', 'Water 2026-09']);
  });

  // A bulk meter's cost is the landlord's. Recovering it from one tenant would
  // charge them for the whole building.
  it('refuses a bulk meter outright', () => {
    const out = buildRecoveryLines([r({ unitId: null })], '2026-09');
    expect(out.lines).toHaveLength(0);
    expect(out.skipped[0].reason).toBe('bulk_meter');
  });

  it('skips a reading with no cost rather than inventing one', () => {
    const out = buildRecoveryLines([r({ cost: null })], '2026-09');
    expect(out.lines).toHaveLength(0);
    expect(out.skipped[0].reason).toBe('no_cost');
  });

  it('calls a first reading a baseline, not a missing cost', () => {
    const out = buildRecoveryLines([r({ consumption: null, cost: null })], '2026-09');
    expect(out.skipped[0].reason).toBe('baseline');
  });

  it('skips a zero charge rather than billing nothing', () => {
    const out = buildRecoveryLines([r({ cost: 0 })], '2026-09');
    expect(out.skipped[0].reason).toBe('zero_cost');
  });

  // Billed, but the tenant is told. Not billing until someone walks the
  // building is how three months of charges arrive at once.
  it('recovers an estimated reading and says so on the line', () => {
    const out = buildRecoveryLines([r({ estimated: true })], '2026-09');
    expect(out.lines[0].description).toContain('estimated');
    expect(out.lines[0].amount).toBe(687.5);
  });

  it('produces a tax-exclusive amount, leaving VAT to the invoice builder', () => {
    const out = buildRecoveryLines([r({ cost: 100 })], '2026-09');
    expect(out.lines[0].amount).toBe(100);
  });

  it('handles an empty period', () => {
    expect(buildRecoveryLines([], '2026-09').total).toBe(0);
  });
});
