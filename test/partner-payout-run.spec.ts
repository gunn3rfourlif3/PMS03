import { buildPayoutRun, isQuarterEnd, payoutDecision, PAYOUT_FLOOR_DEFAULT } from '../src/modules/partners/payout-run';
import { isAtOpenLeadCap, OPEN_LEAD_CAP_DEFAULT } from '../src/modules/partners/pipeline';

describe('payout floor and quarterly sweep (§4.1)', () => {
  it('pays at or above the floor', () => {
    expect(payoutDecision(250).payable).toBe(true);
    expect(payoutDecision(250).reason).toBe('floor_met');
    expect(payoutDecision(1065).payable).toBe(true);
  });

  it('holds below the floor outside a quarter end', () => {
    const d = payoutDecision(74);
    expect(d.payable).toBe(false);
    expect(d.reason).toBe('below_floor');
  });

  it('releases anything owed at a quarter end', () => {
    const d = payoutDecision(74, PAYOUT_FLOOR_DEFAULT, true);
    expect(d.payable).toBe(true);
    expect(d.reason).toBe('quarterly_sweep');
  });

  it('never pays a zero or negative balance, even on a sweep', () => {
    expect(payoutDecision(0, 250, true)).toEqual({ payable: false, reason: 'nothing_due' });
    expect(payoutDecision(-10, 250, true).payable).toBe(false);
  });

  // The case that drove the change: R74/month at the old R500 floor meant the
  // first payout landed in month seven. At R250 it is month four.
  it('an Introducer on one Starter agency waits four months, not seven', () => {
    const monthly = 74;
    const firstPayable = (floor: number) => {
      for (let m = 1; m <= 12; m += 1) if (monthly * m >= floor) return m;
      return Infinity;
    };
    expect(firstPayable(500)).toBe(7);
    expect(firstPayable(PAYOUT_FLOOR_DEFAULT)).toBe(4);
  });

  it('identifies March, June, September and December', () => {
    const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => isQuarterEnd(new Date(2026, m, 15)));
    expect(months).toEqual([false, false, true, false, false, true, false, false, true, false, false, true]);
  });
});

describe('buildPayoutRun', () => {
  const candidate = (partnerId: string, total: number, hasBanking = true) => ({
    partnerId, partnerName: `Partner ${partnerId}`, total,
    commissionIds: [`c-${partnerId}`], periods: ['2026-07'], hasBanking,
  });

  it('splits payable from held and totals both', () => {
    const run = buildPayoutRun([candidate('a', 1065), candidate('b', 74)], {
      asOf: new Date(2026, 6, 15), // July — not a quarter end
    });
    expect(run.quarterEnd).toBe(false);
    expect(run.payableTotal).toBe(1065);
    expect(run.heldTotal).toBe(74);
    expect(run.lines[0].partnerId).toBe('a');
  });

  it('a quarter end releases the held balance too', () => {
    const run = buildPayoutRun([candidate('a', 1065), candidate('b', 74)], {
      asOf: new Date(2026, 8, 30), // September
    });
    expect(run.payableTotal).toBe(1139);
    expect(run.heldTotal).toBe(0);
  });

  it('holds a payable partner who has no banking details', () => {
    const run = buildPayoutRun([candidate('a', 1065, false)], { asOf: new Date(2026, 6, 15) });
    expect(run.lines[0].payable).toBe(true);
    expect(run.lines[0].blocked).toBeTruthy();
    expect(run.payableTotal).toBe(0);
    expect(run.heldTotal).toBe(1065);
  });

  it('does not accumulate floating-point noise across lines', () => {
    const run = buildPayoutRun(
      [candidate('a', 0.1), candidate('b', 0.2)],
      { asOf: new Date(2026, 8, 30) },
    );
    expect(run.payableTotal).toBe(0.3);
  });
});

describe('open lead cap (§7)', () => {
  it('blocks at the cap, not before', () => {
    expect(isAtOpenLeadCap(19, 20)).toBe(false);
    expect(isAtOpenLeadCap(20, 20)).toBe(true);
    expect(isAtOpenLeadCap(21, 20)).toBe(true);
  });

  it('defaults to 20', () => {
    expect(OPEN_LEAD_CAP_DEFAULT).toBe(20);
    expect(isAtOpenLeadCap(20)).toBe(true);
  });
});
