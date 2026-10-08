import {
  staleDealsSignal,
  openLeadCapSignal,
  bankingSignal,
  STALE_DEAL_DAYS,
  DealLike,
} from '../web-admin/components/assistant/signals';

const NOW = Date.UTC(2026, 8, 28, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const deal = (d: Partial<DealLike> = {}): DealLike => ({
  stage: 'lead', stageChangedAt: daysAgo(1), ...d,
});

describe('stale open deals', () => {
  it('says nothing when every open deal moved recently', () => {
    expect(staleDealsSignal([deal(), deal({ stage: 'demo' })], NOW)).toBeNull();
  });

  it('counts an open deal past the threshold', () => {
    const s = staleDealsSignal([deal({ stageChangedAt: daysAgo(STALE_DEAL_DAYS + 1) })], NOW);
    expect(s).toMatchObject({ id: 'stale-deals', href: '/partner/pipeline' });
    expect(s!.text).toBe('1 deal has not moved in two weeks');
  });

  it('pluralises', () => {
    const old = deal({ stage: 'proposal', stageChangedAt: daysAgo(60) });
    expect(staleDealsSignal([old, old, old], NOW)!.text).toBe('3 deals have not moved in two weeks');
  });

  // Closed deals sit untouched forever by definition; counting them would make
  // the signal permanent and therefore ignorable.
  it('ignores won and lost deals however old', () => {
    expect(staleDealsSignal([
      deal({ stage: 'won', stageChangedAt: daysAgo(400) }),
      deal({ stage: 'lost', stageChangedAt: daysAgo(400) }),
    ], NOW)).toBeNull();
  });

  it('does not treat a missing or unparseable timestamp as stale', () => {
    expect(staleDealsSignal([deal({ stageChangedAt: null }), deal({ stageChangedAt: 'nonsense' })], NOW)).toBeNull();
  });

  // The boundary is the one an off-by-one lands on.
  it('fires strictly past the threshold, not on it', () => {
    expect(staleDealsSignal([deal({ stageChangedAt: new Date(NOW - STALE_DEAL_DAYS * DAY) })], NOW)).toBeNull();
    expect(staleDealsSignal([deal({ stageChangedAt: new Date(NOW - STALE_DEAL_DAYS * DAY - 1) })], NOW)).not.toBeNull();
  });

  it('accepts Date, string and epoch alike', () => {
    expect(staleDealsSignal([deal({ stageChangedAt: NOW - 30 * DAY })], NOW)).not.toBeNull();
    expect(staleDealsSignal([deal({ stageChangedAt: new Date(NOW - 30 * DAY) })], NOW)).not.toBeNull();
  });

  it('says nothing about an empty pipeline', () => {
    expect(staleDealsSignal([], NOW)).toBeNull();
  });
});

describe('open lead cap', () => {
  it('stays quiet below the cap', () => {
    expect(openLeadCapSignal(19, 20)).toBeNull();
  });

  it('fires at the cap and above it', () => {
    expect(openLeadCapSignal(20, 20)).toMatchObject({ id: 'open-lead-cap', href: '/partner/pipeline' });
    expect(openLeadCapSignal(23, 20)).not.toBeNull();
  });

  // The cap is a rate-like rule; the panel must never restate it.
  it('never states the cap number in its text', () => {
    expect(openLeadCapSignal(20, 20)!.text).not.toMatch(/\d/);
  });

  it('says nothing when the cap is not a usable number', () => {
    expect(openLeadCapSignal(50, 0)).toBeNull();
    expect(openLeadCapSignal(50, NaN)).toBeNull();
  });
});

describe('banking', () => {
  const complete = {
    bankName: 'A', accountHolder: 'B', accountNumber: '123456789',
    branchCode: '250655', accountType: 'cheque',
  };

  it('says nothing when every field is filled', () => {
    expect(bankingSignal(complete)).toBeNull();
  });

  it('fires on an empty or absent record', () => {
    expect(bankingSignal({})).toMatchObject({ id: 'banking-missing', href: '/partner/banking' });
    expect(bankingSignal(null)).not.toBeNull();
    expect(bankingSignal(undefined)).not.toBeNull();
  });

  it('fires when a single field is blank or whitespace', () => {
    expect(bankingSignal({ ...complete, branchCode: '' })).not.toBeNull();
    expect(bankingSignal({ ...complete, accountHolder: '   ' })).not.toBeNull();
  });

  // The page hands back a masked account number; treating that as blank would
  // nag a partner whose details are already on file.
  it('accepts a masked account number as present', () => {
    const { accountNumber, ...rest } = complete;
    expect(bankingSignal({ ...rest, accountNumberLast4: '6789' })).toBeNull();
  });
});
