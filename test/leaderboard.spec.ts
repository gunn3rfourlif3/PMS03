import {
  movement,
  gateProgress,
  leaksOtherPartnersMoney,
  podium,
  isLeaderboardWindow,
  RESELLER_GATE_MONTHLY,
  RESELLER_GATE_MONTHS,
  LeaderboardRow,
} from '../src/modules/partners/leaderboard';

const row = (p: Partial<LeaderboardRow>): LeaderboardRow => ({
  rank: 1, name: 'A', partnerId: null, isSelf: false, prevRank: null,
  liveAgencies: 0, activeMonths: 0, collected: null, collected3m: null,
  qualifyingMonths: null, ...p,
});

describe('rank movement', () => {
  // A smaller rank is better, so this is easy to invert by accident.
  it('treats a lower rank number as an improvement', () => {
    expect(movement(2, 5)).toBe('up');
    expect(movement(5, 2)).toBe('down');
    expect(movement(3, 3)).toBe('same');
  });

  it('reports an unranked partner as new rather than up', () => {
    expect(movement(1, null)).toBe('new');
    expect(movement(1, undefined)).toBe('new');
  });
});

describe('Reseller gate progress', () => {
  it('measures months met, not rands banked', () => {
    // One enormous month is not three qualifying months. A bar that filled on
    // R45,000 in a single month would be promising a promotion that is not due.
    const oneBigMonth = gateProgress(1, 45000);
    expect(oneBigMonth.qualified).toBe(false);
    expect(oneBigMonth.monthsMet).toBe(1);
    expect(oneBigMonth.fraction).toBeCloseTo(1 / 3);
  });

  it('qualifies at three months', () => {
    const g = gateProgress(RESELLER_GATE_MONTHS, RESELLER_GATE_MONTHLY);
    expect(g.qualified).toBe(true);
    expect(g.fraction).toBe(1);
    expect(g.monthsNeeded).toBe(0);
  });

  it('never exceeds a full ring', () => {
    expect(gateProgress(9, 999999).fraction).toBe(1);
    expect(gateProgress(9, 999999).monthsNeeded).toBe(0);
  });

  it('reports the shortfall for the current month', () => {
    expect(gateProgress(0, 4000).shortfallThisMonth).toBe(RESELLER_GATE_MONTHLY - 4000);
    expect(gateProgress(0, RESELLER_GATE_MONTHLY).shortfallThisMonth).toBe(0);
    expect(gateProgress(0, 20000).shortfallThisMonth).toBe(0);
  });

  it('treats missing figures as zero rather than NaN', () => {
    const g = gateProgress(null, undefined);
    expect(g.monthsMet).toBe(0);
    expect(g.fraction).toBe(0);
    expect(g.shortfallThisMonth).toBe(RESELLER_GATE_MONTHLY);
  });
});

describe('privacy guard', () => {
  // PARTNER_PORTAL_DESIGN.md §6.2: a partner sees rank, name and headline
  // metric for others — never their revenue, because a rival who knows the
  // rate bands can turn it into that partner's income.
  it('passes a correctly scoped board', () => {
    const rows = [
      row({ rank: 1, name: 'Me', isSelf: true, partnerId: 'p1', collected: 42000, collected3m: 90000 }),
      row({ rank: 2, name: 'Someone else' }),
    ];
    expect(leaksOtherPartnersMoney(rows)).toBe(false);
  });

  it('catches a rand figure on another partner', () => {
    expect(leaksOtherPartnersMoney([row({ rank: 2, name: 'Rival', collected: 9000 })])).toBe(true);
    expect(leaksOtherPartnersMoney([row({ rank: 2, name: 'Rival', collected3m: 9000 })])).toBe(true);
  });

  it('catches an id on another partner, which would let a client correlate rows', () => {
    expect(leaksOtherPartnersMoney([row({ rank: 2, name: 'Rival', partnerId: 'p2' })])).toBe(true);
  });

  it('does not mistake a zero for a redaction', () => {
    // collected: 0 on your own row is a real value and must not trip the guard.
    expect(leaksOtherPartnersMoney([row({ isSelf: true, partnerId: 'p1', collected: 0 })])).toBe(false);
  });
});

describe('podium', () => {
  const rows = [1, 2, 3, 4, 5].map((n) => row({ rank: n, name: `P${n}` }));

  it('returns the top three', () => {
    expect(podium(rows).top.map((r) => r.name)).toEqual(['P1', 'P2', 'P3']);
  });

  it('surfaces the caller separately when they placed outside it', () => {
    const withSelf = rows.map((r) => (r.rank === 5 ? { ...r, isSelf: true } : r));
    expect(podium(withSelf).self?.name).toBe('P5');
  });

  it('does not duplicate the caller when they are already on the podium', () => {
    const withSelf = rows.map((r) => (r.rank === 2 ? { ...r, isSelf: true } : r));
    expect(podium(withSelf).self).toBeNull();
  });

  it('handles a board smaller than the podium', () => {
    expect(podium([rows[0]]).top).toHaveLength(1);
    expect(podium([]).top).toEqual([]);
    expect(podium([]).self).toBeNull();
  });
});

describe('window validation', () => {
  it('accepts only the three known windows', () => {
    expect(isLeaderboardWindow('month')).toBe(true);
    expect(isLeaderboardWindow('quarter')).toBe(true);
    expect(isLeaderboardWindow('all')).toBe(true);
  });

  it('rejects anything else, so a query param cannot reach the SQL unchecked', () => {
    for (const bad of ['year', '', null, undefined, 1, {}, "month'; DROP TABLE partners; --"]) {
      expect(isLeaderboardWindow(bad)).toBe(false);
    }
  });
});
