import {
  TEMPLATE, TEMPLATE_TOTAL_HOURS, TEMPLATE_VERSION, STAGES, stageName,
} from '../src/modules/onboarding/onboarding-template';
import {
  ProgressItem, progressOf, currentStage, waitingOn, daysStalled, stageState, stageSummaries, isComplete, fromTemplate,
} from '../src/modules/onboarding/onboarding-progress';

const item = (over: Partial<ProgressItem> = {}): ProgressItem => ({
  stage: 0, status: 'pending', waitingOn: 'locare', weightHours: 1, ...over,
});

describe('onboarding template', () => {
  it('covers all ten stages with unique keys', () => {
    expect(STAGES).toHaveLength(10);
    const keys = TEMPLATE.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of STAGES) {
      expect(TEMPLATE.filter((t) => t.stage === s.stage).length).toBeGreaterThan(0);
    }
  });

  it('is weighted to the 22-hour onboarding the pricing decision was based on', () => {
    // MIN_BILLABLE_UNITS is 30 because onboarding costs about R13,200 at 22
    // hours. If this total drifts, the pricing floor is quoting a cost that no
    // longer exists — so the two are pinned together on purpose.
    // Pinned to the half hour, not the minute: the estimate is not that precise,
    // but a template that quietly grew to 30 hours would invalidate the floor.
    expect(TEMPLATE_TOTAL_HOURS).toBeCloseTo(22, 0);
  });

  it('puts the weight where the work actually is', () => {
    const byStage = (n: number) => TEMPLATE.filter((t) => t.stage === n).reduce((s, t) => s + t.weightHours, 0);
    // Stage 5 (data migration) is the single largest, by a distance.
    const stage5 = byStage(5);
    for (const s of STAGES.filter((s) => s.stage !== 5)) expect(byStage(s.stage)).toBeLessThan(stage5);
    expect(stage5 / TEMPLATE_TOTAL_HOURS).toBeGreaterThan(0.25);
  });

  it('starts intake waiting on us, not on the agency', () => {
    // A brand-new onboarding is waiting on someone HERE to go and ask. Defaulting
    // these to the agency made every fresh agency look slow about questions
    // nobody had put to them, and left "waiting on us" reading zero.
    const intake = TEMPLATE.filter((t) => t.stage === 0);
    expect(intake.every((t) => t.waitingOn === 'locare')).toBe(true);
    expect(waitingOn(fromTemplate(TEMPLATE))).toBe('locare');
  });

  it('leaves the first and last stages entirely to humans', () => {
    // Intake and handover are conversations. No query can tell you they happened,
    // and pretending otherwise would put a green tick on an unverified claim.
    expect(TEMPLATE.filter((t) => t.stage === 0).every((t) => !t.verifiable)).toBe(true);
    expect(TEMPLATE.filter((t) => t.stage === 9).every((t) => !t.verifiable)).toBe(true);
  });

  it('names its version', () => {
    expect(TEMPLATE_VERSION).toMatch(/^runbook-\d{4}-\d{2}$/);
    expect(stageName(5)).toBe('Data migration');
  });
});

describe('progress', () => {
  it('weights by hours, not by item count', () => {
    // Four trivial items done and the one big one outstanding is NOT 80%.
    const items = [
      item({ status: 'done', weightHours: 0.5 }), item({ status: 'done', weightHours: 0.5 }),
      item({ status: 'done', weightHours: 0.5 }), item({ status: 'done', weightHours: 0.5 }),
      item({ status: 'pending', weightHours: 8 }),
    ];
    expect(progressOf(items).itemsDone).toBe(4);
    expect(progressOf(items).percent).toBe(20);
  });

  it('counts failed items separately from the percentage', () => {
    // "Not moving for 2 days" and "a check is broken" are different problems,
    // and the first hides the second unless it is carried on its own.
    const items = [item({ status: 'done' }), item({ status: 'failed' }), item({ status: 'pending' })];
    expect(progressOf(items).itemsFailed).toBe(1);
    expect(progressOf([item({ status: 'pending' })]).itemsFailed).toBe(0);
  });

  it('counts skipped as complete but failed as outstanding', () => {
    // An agency with no data to migrate has genuinely finished stage 5. A check
    // that ran and came back broken has not.
    expect(isComplete('skipped')).toBe(true);
    expect(isComplete('failed')).toBe(false);
    expect(progressOf([item({ status: 'skipped' }), item({ status: 'failed' })]).percent).toBe(50);
  });

  it('reports hours left, not just a percentage', () => {
    const p = progressOf([item({ status: 'done', weightHours: 2 }), item({ weightHours: 6 })]);
    expect(p.totalHours).toBe(8);
    expect(p.remainingHours).toBe(6);
  });

  it('survives a fresh template and an empty checklist', () => {
    expect(progressOf(fromTemplate(TEMPLATE)).percent).toBe(0);
    expect(progressOf([]).percent).toBe(0);          // no divide-by-zero
    expect(currentStage([])).toBeNull();
  });

  it('treats numeric strings from Postgres as numbers', () => {
    expect(progressOf([item({ status: 'done', weightHours: '2.5' }), item({ weightHours: '2.5' })]).percent).toBe(50);
  });
});

describe('current stage and gating', () => {
  const items = [
    item({ stage: 0, status: 'done' }),
    item({ stage: 1, status: 'done' }),
    item({ stage: 2, status: 'pending' }),
    item({ stage: 3, status: 'pending' }),
  ];

  it('is the lowest stage with work left', () => {
    expect(currentStage(items)).toBe(2);
  });

  it('opens exactly one stage', () => {
    expect(stageState(items, 1)).toBe('complete');
    expect(stageState(items, 2)).toBe('current');
    expect(stageState(items, 3)).toBe('locked');
  });

  it('reports complete when nothing is left', () => {
    const done = items.map((i) => ({ ...i, status: 'done' as const }));
    expect(currentStage(done)).toBeNull();
    expect(waitingOn(done)).toBeNull();
  });

  it('rolls each stage up for the stage cards', () => {
    const rows = stageSummaries(items);
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.stage === 2)).toMatchObject({ state: 'current', done: 0, total: 1 });
  });
});

describe('waiting on', () => {
  it('names a third party ahead of anyone else', () => {
    // An agency stuck three weeks on its own DNS provider is not us being slow,
    // and the portfolio view must not read as though it were.
    const items = [
      item({ stage: 2, status: 'pending', waitingOn: 'locare' }),
      item({ stage: 2, status: 'pending', waitingOn: 'third_party' }),
    ];
    expect(waitingOn(items)).toBe('third_party');
  });

  it('names the agency ahead of us', () => {
    const items = [
      item({ stage: 3, status: 'pending', waitingOn: 'locare' }),
      item({ stage: 3, status: 'pending', waitingOn: 'agency' }),
    ];
    expect(waitingOn(items)).toBe('agency');
  });

  it('ignores completed items when deciding', () => {
    const items = [
      item({ stage: 2, status: 'done', waitingOn: 'third_party' }),
      item({ stage: 2, status: 'pending', waitingOn: 'locare' }),
    ];
    expect(waitingOn(items)).toBe('locare');
  });

  it('only looks at the current stage', () => {
    const items = [
      item({ stage: 2, status: 'pending', waitingOn: 'locare' }),
      item({ stage: 5, status: 'pending', waitingOn: 'third_party' }),
    ];
    expect(waitingOn(items)).toBe('locare');
  });
});

describe('days stalled', () => {
  const now = new Date('2026-09-10T12:00:00Z');

  it('counts from the most recent movement', () => {
    const items = [
      item({ updatedAt: '2026-09-01T12:00:00Z' }),
      item({ updatedAt: '2026-09-07T12:00:00Z' }),
    ];
    expect(daysStalled(items, now)).toBe(3);
  });

  it('is zero on the day something moved, and never negative', () => {
    expect(daysStalled([item({ updatedAt: now })], now)).toBe(0);
    expect(daysStalled([item({ updatedAt: '2026-12-01T00:00:00Z' })], now)).toBe(0);
  });

  it('handles a checklist with no timestamps', () => {
    expect(daysStalled([item({ updatedAt: null })], now)).toBe(0);
    expect(daysStalled([], now)).toBe(0);
  });
});
