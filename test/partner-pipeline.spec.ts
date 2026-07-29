import { isDealStage, pipelineValue, DEAL_STAGES } from '../src/modules/partners/pipeline';

describe('partner pipeline helpers', () => {
  it('validates stages', () => {
    expect(DEAL_STAGES).toContain('demo');
    expect(isDealStage('trial')).toBe(true);
    expect(isDealStage('banana')).toBe(false);
  });

  it('sums expected MRR of open deals only (excludes won/lost)', () => {
    const deals = [
      { stage: 'lead' as const, expectedMrr: 1000 },
      { stage: 'demo' as const, expectedMrr: 2500 },
      { stage: 'won' as const, expectedMrr: 9999 },
      { stage: 'lost' as const, expectedMrr: 4000 },
    ];
    expect(pipelineValue(deals)).toBe(3500);
  });
});
