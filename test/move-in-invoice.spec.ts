import { buildMoveInLines } from '../src/modules/listings/move-in-invoice';

describe('move-in invoice line builder', () => {
  it('includes only rent when there is no admin fee or deposit', () => {
    const { lines, total } = buildMoveInLines({ rent: 8000, rentLabel: 'Rent 2026-08' });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ label: 'Rent 2026-08', amount: 8000 });
    expect(total).toBe(8000);
  });

  it('adds admin fee and deposit when present, and totals them', () => {
    const { lines, total } = buildMoveInLines({
      rent: 5161.29, rentLabel: 'Rent 2026-08 (pro-rata 20/31 days)', adminFee: 500, deposit: 8000,
    });
    expect(lines.map((l) => l.label)).toEqual([
      'Rent 2026-08 (pro-rata 20/31 days)',
      'Admin / lease fee',
      'Security deposit (refundable)',
    ]);
    expect(total).toBe(13661.29);
  });

  it('skips zero/negative charges', () => {
    const { lines } = buildMoveInLines({ rent: 8000, rentLabel: 'Rent', adminFee: 0, deposit: -1 });
    expect(lines).toHaveLength(1);
  });
});
