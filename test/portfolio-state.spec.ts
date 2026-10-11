import {
  PortfolioUnitRow,
  SEVERITY,
  LEASE_EXPIRY_WINDOW_DAYS,
  daysBetween,
  deriveUnitState,
  summarisePortfolio,
} from '../src/modules/reporting/portfolio-state';

const TODAY = '2026-06-15';

/** A clean, occupied, paid-up, recently inspected unit. Override one field per test. */
function unit(over: Partial<PortfolioUnitRow> = {}): PortfolioUnitRow {
  return {
    unitId: 'u1',
    propertyId: 'p1',
    propertyName: 'Midnight Court',
    label: 'A101',
    unitStatus: 'occupied',
    leaseId: 'l1',
    leaseStatus: 'active',
    leaseEndDate: '2027-01-31',
    tenantId: 't1',
    rentAmount: 9500,
    outstanding: 0,
    maxDaysOverdue: 0,
    openTickets: 0,
    urgentTickets: 0,
    lastInspectionOn: '2026-03-01',
    ...over,
  };
}

describe('daysBetween', () => {
  it('counts whole days forward and backward', () => {
    expect(daysBetween('2026-06-15', '2026-06-20')).toBe(5);
    expect(daysBetween('2026-06-20', '2026-06-15')).toBe(-5);
    expect(daysBetween('2026-06-15', '2026-06-15')).toBe(0);
  });

  // Parsed as UTC on purpose: local-time parsing shifts a date across midnight
  // for anyone east or west of UTC, which would silently move a lease's expiry.
  it('crosses a month and a leap-year February without drifting', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('returns 0 rather than NaN for an unparseable date', () => {
    expect(daysBetween('not-a-date', TODAY)).toBe(0);
  });
});

describe('deriveUnitState — arrears', () => {
  it('leaves a paid-up unit alone', () => {
    const u = deriveUnitState(unit(), TODAY);
    expect(u.state).toBe('ok');
    expect(u.flags).toEqual([]);
    expect(u.arrearsBucket).toBeNull();
  });

  it.each([
    [10, '0-30', 'arrears_0_30'],
    [45, '31-60', 'arrears_31_60'],
    [75, '61-90', 'arrears_61_90'],
    [200, '90+', 'arrears_90_plus'],
  ])('%i days overdue is bucket %s and state %s', (days, bucket, state) => {
    const u = deriveUnitState(unit({ maxDaysOverdue: days as number, outstanding: 5000 }), TODAY);
    expect(u.arrearsBucket).toBe(bucket);
    expect(u.state).toBe(state);
    expect(u.flags).toContain('arrears');
  });

  // Outstanding with nothing past due is money not yet late, not arrears.
  it('does not call a not-yet-due invoice arrears', () => {
    const u = deriveUnitState(unit({ outstanding: 9500, maxDaysOverdue: 0 }), TODAY);
    expect(u.arrearsBucket).toBeNull();
    expect(u.flags).not.toContain('arrears');
  });

  it('does not call a zero balance arrears however old the invoice', () => {
    const u = deriveUnitState(unit({ outstanding: 0, maxDaysOverdue: 300 }), TODAY);
    expect(u.arrearsBucket).toBeNull();
  });
});

describe('deriveUnitState — occupancy and lease', () => {
  it('marks a unit with no live lease vacant', () => {
    const u = deriveUnitState(
      unit({ unitStatus: 'vacant', leaseId: null, leaseStatus: null, leaseEndDate: null }),
      TODAY,
    );
    expect(u.state).toBe('vacant');
    expect(u.occupied).toBe(false);
  });

  // A draft or ended lease is not a tenancy: the unit is empty.
  it.each(['draft', 'ended', 'terminated'])('treats a %s lease as vacant', (status) => {
    const u = deriveUnitState(unit({ leaseStatus: status, unitStatus: 'vacant' }), TODAY);
    expect(u.occupied).toBe(false);
    expect(u.flags).toContain('vacant');
  });

  it('counts an ending lease as still occupied', () => {
    const u = deriveUnitState(unit({ leaseStatus: 'ending' }), TODAY);
    expect(u.occupied).toBe(true);
  });

  it('distinguishes offline and under-maintenance from an unnoticed vacancy', () => {
    expect(deriveUnitState(unit({ unitStatus: 'offline', leaseStatus: null }), TODAY).state)
      .toBe('offline');
    const m = deriveUnitState(unit({ unitStatus: 'maintenance', leaseStatus: null }), TODAY);
    expect(m.state).toBe('maintenance_open');
    expect(m.flags).toContain('under_maintenance');
    expect(m.flags).not.toContain('vacant');
  });

  it('flags a lease ending inside the window, and not one beyond it', () => {
    const inside = deriveUnitState(unit({ leaseEndDate: '2026-08-01' }), TODAY);
    expect(inside.state).toBe('lease_expiring');
    const outside = deriveUnitState(unit({ leaseEndDate: '2026-12-01' }), TODAY);
    expect(outside.state).toBe('ok');
  });

  it('includes the last day of the window', () => {
    const edge = new Date(Date.parse(`${TODAY}T00:00:00Z`) + LEASE_EXPIRY_WINDOW_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(deriveUnitState(unit({ leaseEndDate: edge }), TODAY).state).toBe('lease_expiring');
  });

  // A live lease past its end date is a holdover — the agency is housing a
  // tenant on an agreement that ran out, which outranks a mere expiry warning.
  it('calls a live lease past its end date expired, not expiring', () => {
    const u = deriveUnitState(unit({ leaseEndDate: '2026-05-01' }), TODAY);
    expect(u.state).toBe('lease_expired');
    expect(u.flags).toContain('lease_expired');
    expect(u.flags).not.toContain('lease_expiring');
  });

  it('does not judge expiry on a month-to-month lease with no end date', () => {
    const u = deriveUnitState(unit({ leaseEndDate: null }), TODAY);
    expect(u.state).toBe('ok');
  });

  it('never flags a vacant unit as expiring', () => {
    const u = deriveUnitState(
      unit({ unitStatus: 'vacant', leaseStatus: null, leaseEndDate: '2026-06-20' }),
      TODAY,
    );
    expect(u.flags).not.toContain('lease_expiring');
    expect(u.state).toBe('vacant');
  });
});

describe('deriveUnitState — maintenance and inspections', () => {
  it('raises an urgent ticket above an ordinary one', () => {
    expect(deriveUnitState(unit({ openTickets: 2 }), TODAY).state).toBe('maintenance_open');
    const urgent = deriveUnitState(unit({ openTickets: 2, urgentTickets: 1 }), TODAY);
    expect(urgent.state).toBe('maintenance_urgent');
    expect(urgent.flags).toContain('maintenance_open');
  });

  it('separates never inspected from a cadence that slipped', () => {
    const never = deriveUnitState(unit({ lastInspectionOn: null }), TODAY);
    expect(never.flags).toContain('inspection_never');
    expect(never.flags).toContain('inspection_overdue');

    const stale = deriveUnitState(unit({ lastInspectionOn: '2024-01-01' }), TODAY);
    expect(stale.flags).toContain('inspection_overdue');
    expect(stale.flags).not.toContain('inspection_never');
  });

  it('leaves a recent inspection unflagged', () => {
    expect(deriveUnitState(unit({ lastInspectionOn: '2026-03-01' }), TODAY).flags)
      .not.toContain('inspection_overdue');
  });

  it('honours an overridden inspection interval', () => {
    const u = deriveUnitState(unit({ lastInspectionOn: '2026-01-01' }), TODAY, {
      inspectionIntervalDays: 30,
    });
    expect(u.flags).toContain('inspection_overdue');
  });
});

describe('deriveUnitState — worst condition wins the colour', () => {
  // The whole point of the halo: one colour, every problem still visible.
  it('paints the worst state while keeping the rest as flags', () => {
    const u = deriveUnitState(
      unit({
        maxDaysOverdue: 120,
        outstanding: 30000,
        openTickets: 3,
        urgentTickets: 1,
        lastInspectionOn: null,
        leaseEndDate: '2026-07-01',
      }),
      TODAY,
    );
    expect(u.state).toBe('arrears_90_plus');
    expect(u.severity).toBe(SEVERITY.arrears_90_plus);
    expect(u.flags).toEqual(
      expect.arrayContaining([
        'arrears',
        'lease_expiring',
        'maintenance_urgent',
        'maintenance_open',
        'inspection_never',
        'inspection_overdue',
      ]),
    );
  });

  it('prefers a vacancy to light arrears, and heavy arrears to a vacancy', () => {
    const vacantAndLightArrears = deriveUnitState(
      unit({ unitStatus: 'vacant', leaseStatus: null, maxDaysOverdue: 5, outstanding: 1000 }),
      TODAY,
    );
    expect(vacantAndLightArrears.state).toBe('vacant');

    const vacantAndHeavyArrears = deriveUnitState(
      unit({ unitStatus: 'vacant', leaseStatus: null, maxDaysOverdue: 95, outstanding: 1000 }),
      TODAY,
    );
    expect(vacantAndHeavyArrears.state).toBe('arrears_90_plus');
  });

  it('never emits a duplicate flag', () => {
    const u = deriveUnitState(unit({ openTickets: 1, urgentTickets: 1 }), TODAY);
    expect(new Set(u.flags).size).toBe(u.flags.length);
  });
});

describe('summarisePortfolio', () => {
  it('counts units, properties, occupancy, arrears and tickets', () => {
    const units = [
      deriveUnitState(unit({ unitId: 'a', propertyId: 'p1' }), TODAY),
      deriveUnitState(
        unit({ unitId: 'b', propertyId: 'p1', maxDaysOverdue: 40, outstanding: 1500.5 }),
        TODAY,
      ),
      deriveUnitState(
        unit({ unitId: 'c', propertyId: 'p2', unitStatus: 'vacant', leaseStatus: null, openTickets: 2 }),
        TODAY,
      ),
    ];
    const s = summarisePortfolio(units);
    expect(s.units).toBe(3);
    expect(s.properties).toBe(2);
    expect(s.occupied).toBe(2);
    expect(s.vacant).toBe(1);
    expect(s.occupancyRate).toBeCloseTo(66.67, 2);
    expect(s.unitsInArrears).toBe(1);
    expect(s.arrearsOutstanding).toBe(1500.5);
    expect(s.openTickets).toBe(2);
    expect(s.byState.arrears_31_60).toBe(1);
  });

  // The legend is built from byState's keys, so a missing key would make a
  // swatch vanish between refreshes.
  it('reports every state as a key even at zero', () => {
    const s = summarisePortfolio([]);
    expect(Object.keys(s.byState).sort()).toEqual(Object.keys(SEVERITY).sort());
    expect(s.units).toBe(0);
    expect(s.occupancyRate).toBe(0);
  });
});
