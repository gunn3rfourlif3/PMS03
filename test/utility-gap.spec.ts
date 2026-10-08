import { computeGap, computeGaps, gapsToCsv, GapRow } from '../src/modules/utilities/utility-gap';

const base: GapRow = {
  propertyId: 'p1', propertyName: 'Masquerade Heights', kind: 'water', period: '2026-09',
  bulkConsumption: 1000, bulkCost: 25000, subConsumption: 920, subCost: 23000, subMeters: 96,
};

describe('recovery gap', () => {
  it('is bulk minus the submeters, in units and in rand', () => {
    const r = computeGap(base);
    expect(r.gapConsumption).toBe(80);
    expect(r.gapCost).toBe(2000);
    expect(r.gapPct).toBe(8);
  });

  it('is zero when every unit is accounted for', () => {
    const r = computeGap({ ...base, subConsumption: 1000 });
    expect(r.gapConsumption).toBe(0);
    expect(r.gapPct).toBe(0);
  });

  // Submeters reading higher than the bulk is a real and informative result —
  // a misassigned meter, or a bulk reading taken on the wrong day.
  it('goes negative rather than clamping when submeters exceed the bulk', () => {
    const r = computeGap({ ...base, subConsumption: 1100 });
    expect(r.gapConsumption).toBe(-100);
    expect(r.gapPct).toBe(-10);
  });

  describe('missing sides', () => {
    // Treating a missing bulk as zero would report the whole submetered total
    // as a surplus. "Not known" is the honest answer.
    it('does not compute a gap without a bulk reading', () => {
      const r = computeGap({ ...base, bulkConsumption: null });
      expect(r.gapConsumption).toBeNull();
      expect(r.note).toContain('No bulk reading');
    });

    it('does not compute a gap without submeter readings', () => {
      const r = computeGap({ ...base, subConsumption: null });
      expect(r.gapConsumption).toBeNull();
      expect(r.note).toContain('No submeter');
    });

    it('still reports a usage gap when only the costs are missing', () => {
      const r = computeGap({ ...base, bulkCost: null, subCost: null });
      expect(r.gapConsumption).toBe(80);
      expect(r.gapCost).toBeNull();
    });
  });

  it('has no percentage against a zero bulk reading', () => {
    const r = computeGap({ ...base, bulkConsumption: 0, subConsumption: 0 });
    expect(r.gapConsumption).toBe(0);
    expect(r.gapPct).toBeNull();
  });
});

describe('csv', () => {
  it('writes a header and a row per result', () => {
    const csv = gapsToCsv(computeGaps([base]));
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Gap usage');
    expect(lines[1]).toContain('Masquerade Heights');
    expect(lines[1]).toContain('80');
  });

  it('quotes a name containing a comma rather than splitting the column', () => {
    const csv = gapsToCsv(computeGaps([{ ...base, propertyName: 'Smith, J' }]));
    expect(csv.split('\n')[1]).toContain('"Smith, J"');
  });

  it('leaves a missing figure blank rather than writing null', () => {
    const csv = gapsToCsv(computeGaps([{ ...base, bulkConsumption: null }]));
    expect(csv.split('\n')[1]).not.toContain('null');
  });
});
