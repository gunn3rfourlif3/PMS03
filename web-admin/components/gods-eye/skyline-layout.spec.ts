/**
 * The skyline's geometry.
 *
 * The ordering cases are the ones that matter most: the tower order IS the
 * claim the scene makes ("this property needs you first"), and a shared link
 * or a screen recording has to agree with what the operator saw.
 */
import {
  DEFAULT_TOWER_LIMIT,
  buildSkyline,
  describeSkyline,
  slotsPerRow,
  towerShape,
} from '@/components/gods-eye/skyline-layout';
import type { PortfolioUnit } from '@/components/gods-eye/state';

let seq = 0;
function unit(over: Partial<PortfolioUnit> = {}): PortfolioUnit {
  seq += 1;
  return {
    unitId: `u${seq}`,
    propertyId: 'p1',
    propertyName: 'Alpha Court',
    label: `A${seq}`,
    unitStatus: 'occupied',
    leaseId: null,
    leaseStatus: null,
    leaseEndDate: null,
    tenantId: null,
    rentAmount: 10000,
    outstanding: 0,
    maxDaysOverdue: 0,
    openTickets: 0,
    urgentTickets: 0,
    lastInspectionOn: null,
    state: 'ok',
    severity: 0,
    flags: [],
    arrearsBucket: null,
    occupied: true,
    ...over,
  };
}

function property(id: string, name: string, count: number, owing: number[] = []): PortfolioUnit[] {
  const out: PortfolioUnit[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(unit({ propertyId: id, propertyName: name, outstanding: owing[i] ?? 0 }));
  }
  return out;
}

describe('towerShape', () => {
  it('is a little taller than wide at realistic sizes', () => {
    const s = towerShape(96);
    expect(s.cols).toBe(7);
    expect(s.floors).toBeGreaterThan(s.cols);
    expect(s.cols * s.floors).toBeGreaterThanOrEqual(96);
  });

  it('never produces a zero or negative dimension', () => {
    for (const n of [0, -5, 1, 2, 3, 7, 500, 2000]) {
      const s = towerShape(n);
      expect(s.cols).toBeGreaterThanOrEqual(1);
      expect(s.floors).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps a one-unit property a one-window sliver rather than padding it out', () => {
    expect(towerShape(1)).toEqual({ cols: 1, floors: 1 });
  });

  it('caps width so a large property grows upward, not sideways', () => {
    expect(towerShape(2000).cols).toBe(7);
  });
});

describe('slotsPerRow', () => {
  it('is 1 for an empty or single-tower scene', () => {
    expect(slotsPerRow(0)).toBe(1);
    expect(slotsPerRow(1)).toBe(1);
  });

  it('stays within five so the back row is still legible', () => {
    for (const n of [4, 9, 16, 40]) expect(slotsPerRow(n)).toBeLessThanOrEqual(5);
  });
});

describe('buildSkyline ordering', () => {
  it('puts the most money at risk nearest the camera', () => {
    const units = [
      ...property('p1', 'Alpha', 4, [0, 0, 0, 0]),
      ...property('p2', 'Bravo', 4, [5000, 0, 0, 0]),
      ...property('p3', 'Delta', 4, [900, 0, 0, 0]),
    ];
    const s = buildSkyline(units);
    expect(s.towers.map((t) => t.propertyName)).toEqual(['Bravo', 'Delta', 'Alpha']);
    expect(s.towers[0]).toMatchObject({ col: 0, row: 0 });
  });

  it('breaks every tie, so the same payload always draws the same scene', () => {
    const units = [
      ...property('p2', 'Same Name', 4),
      ...property('p1', 'Same Name', 4),
    ];
    const a = buildSkyline(units).towers.map((t) => t.propertyId);
    const b = buildSkyline([...units].reverse()).towers.map((t) => t.propertyId);
    expect(a).toEqual(['p1', 'p2']);
    expect(b).toEqual(a);
  });

  it('breaks an equal amount on how many units owe, not on how big the property is', () => {
    // Both owe 100. Bravo spreads it over two units against Alpha's one, and
    // two tenants behind is the worse problem even though Alpha is larger.
    const units = [
      ...property('p1', 'Alpha', 6, [100, 0, 0, 0, 0, 0]),
      ...property('p2', 'Bravo', 3, [50, 50, 0]),
    ];
    const s = buildSkyline(units);
    expect(s.towers.map((t) => t.propertyName)).toEqual(['Bravo', 'Alpha']);
  });

  it('falls back to size only once amount and arrears count both match', () => {
    const units = [
      ...property('p1', 'Small', 3, [100, 0, 0]),
      ...property('p2', 'Large', 9, [100, 0, 0, 0, 0, 0, 0, 0, 0]),
    ];
    expect(buildSkyline(units).towers.map((t) => t.propertyName)).toEqual(['Large', 'Small']);
  });
});

describe('buildSkyline risk', () => {
  it('normalises against the worst property', () => {
    const units = [
      ...property('p1', 'Alpha', 2, [1000, 0]),
      ...property('p2', 'Bravo', 2, [500, 0]),
    ];
    const s = buildSkyline(units);
    expect(s.towers[0].risk).toBe(1);
    expect(s.towers[1].risk).toBe(0.5);
  });

  it('is zero for every tower when nothing is owed — never a divide by zero', () => {
    const s = buildSkyline(property('p1', 'Alpha', 5));
    expect(s.maxOutstanding).toBe(0);
    expect(s.towers.every((t) => t.risk === 0)).toBe(true);
  });

  it('counts only units that actually owe', () => {
    const s = buildSkyline(property('p1', 'Alpha', 4, [300, 0, 200, 0]));
    expect(s.towers[0].outstanding).toBe(500);
    expect(s.towers[0].arrearsUnits).toBe(2);
  });
});

describe('buildSkyline limit', () => {
  it('draws at most the limit and reports the rest rather than dropping them', () => {
    const units: PortfolioUnit[] = [];
    for (let i = 0; i < 20; i += 1) {
      units.push(...property(`p${i}`, `P${i}`, 3, [1000 - i * 10, 0, 0]));
    }
    const s = buildSkyline(units, { limit: 6 });
    expect(s.towers).toHaveLength(6);
    expect(s.hidden).toBe(14);
    expect(s.hiddenUnits).toBe(42);
    expect(s.totalUnits).toBe(60);
  });

  it('keeps the hidden towers out of the risk normalisation', () => {
    // The worst property is hidden by the limit; the drawn ones must not
    // brighten to fill the gap, or the scene would overstate them.
    const units = [
      ...property('p1', 'Worst', 2, [10000, 0]),
      ...property('p2', 'Middle', 2, [1000, 0]),
    ];
    const s = buildSkyline(units, { limit: 1 });
    expect(s.towers.map((t) => t.propertyName)).toEqual(['Worst']);
    const only = buildSkyline(units.slice(2), { limit: 1 });
    expect(only.towers[0].risk).toBe(1);
    const withWorstHidden = buildSkyline(units, { limit: 1 });
    expect(withWorstHidden.maxOutstanding).toBe(10000);
  });

  it('has a sane default and refuses a nonsense limit', () => {
    expect(DEFAULT_TOWER_LIMIT).toBeGreaterThan(1);
    expect(buildSkyline(property('p1', 'Alpha', 2), { limit: 0 }).towers).toHaveLength(1);
  });
});

describe('buildSkyline windows', () => {
  it('keeps the server order rather than stacking by severity', () => {
    const units = [
      unit({ propertyId: 'p1', label: 'A1', state: 'ok' }),
      unit({ propertyId: 'p1', label: 'A2', state: 'arrears_90_plus', outstanding: 900 }),
      unit({ propertyId: 'p1', label: 'A3', state: 'vacant' }),
    ];
    const s = buildSkyline(units);
    expect(s.towers[0].windows.map((w) => w.label)).toEqual(['A1', 'A2', 'A3']);
  });
});

describe('an empty portfolio', () => {
  it('builds a scene with nothing in it rather than throwing', () => {
    const s = buildSkyline([]);
    expect(s.towers).toEqual([]);
    expect(s.hidden).toBe(0);
    expect(s.totalUnits).toBe(0);
    expect(describeSkyline(s)).toBe('No properties to show.');
  });
});

describe('describeSkyline', () => {
  it('names the worst property and the units behind it', () => {
    const units = [
      ...property('p1', 'Alpha Court', 4, [900, 400, 0, 0]),
      ...property('p2', 'Bravo Place', 2),
    ];
    const text = describeSkyline(buildSkyline(units));
    expect(text).toContain('2 properties, 6 units');
    expect(text).toContain('Alpha Court');
    expect(text).toContain('2 of 4 units in arrears');
  });

  it('says how much it is not drawing', () => {
    const units: PortfolioUnit[] = [];
    for (let i = 0; i < 5; i += 1) units.push(...property(`p${i}`, `P${i}`, 2, [100 - i, 0]));
    const text = describeSkyline(buildSkyline(units, { limit: 2 }));
    expect(text).toContain('3 further properties (6 units) not drawn');
  });
});
