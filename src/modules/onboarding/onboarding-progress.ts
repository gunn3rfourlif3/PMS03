import { STAGES, TemplateItem } from './onboarding-template';

/**
 * Pure progress maths for the onboarding console. No database, no Nest — so the
 * rules that decide what an operator sees can be tested directly.
 */

export type OnboardingStatus = 'pending' | 'in_progress' | 'blocked' | 'done' | 'skipped' | 'failed';
export type WaitingOn = 'locare' | 'agency' | 'third_party';

/** The minimum shape the maths needs. Both the entity and the template fit it. */
export interface ProgressItem {
  stage: number;
  status: OnboardingStatus;
  waitingOn: WaitingOn;
  weightHours: number | string;
  updatedAt?: Date | string | null;
}

/**
 * Complete means "no more operator hours here".
 *
 * `skipped` counts. An agency with no data to migrate has genuinely finished
 * stage 5, and a bar that holds that against them is wrong. `failed` does NOT
 * count — a check that ran and came back broken is work still outstanding, and
 * it is deliberately a different state from `pending`, which only means nobody
 * has looked yet.
 */
export const isComplete = (s: OnboardingStatus): boolean => s === 'done' || s === 'skipped';

const hours = (n: number | string): number => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

export interface Progress {
  percent: number;
  doneHours: number;
  totalHours: number;
  remainingHours: number;
  itemsDone: number;
  itemsTotal: number;
  /**
   * Items whose check ran and came back broken.
   *
   * Carried separately from the percentage because "not moving" and "something
   * is broken" are different problems and the first hides the second: an agency
   * reading "2 days, waiting on the agency" sounds like patient chasing even
   * when its ledger is out by fourteen thousand rand.
   */
  itemsFailed: number;
}

/**
 * Weighted by hours, not by item count.
 *
 * Counting items would put the bar past half way after an afternoon of intake
 * and provisioning, then freeze for the three days of data migration. Weighting
 * by effort makes the bar move at roughly the rate the work does.
 */
export function progressOf(items: ProgressItem[]): Progress {
  const totalHours = items.reduce((s, i) => s + hours(i.weightHours), 0);
  const doneHours = items.filter((i) => isComplete(i.status)).reduce((s, i) => s + hours(i.weightHours), 0);
  return {
    percent: totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0,
    doneHours: round1(doneHours),
    totalHours: round1(totalHours),
    remainingHours: round1(Math.max(0, totalHours - doneHours)),
    itemsDone: items.filter((i) => isComplete(i.status)).length,
    itemsTotal: items.length,
    itemsFailed: items.filter((i) => i.status === 'failed').length,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The lowest stage that still has work in it, or null when everything is done. */
export function currentStage(items: ProgressItem[]): number | null {
  const open = items.filter((i) => !isComplete(i.status)).map((i) => i.stage);
  return open.length ? Math.min(...open) : null;
}

/**
 * Who the onboarding is waiting on, taken from the earliest incomplete item.
 *
 * This is the column that makes a stall legible. An agency sitting three weeks
 * on its own DNS provider is not the same as one nobody has touched, and today
 * the two look identical.
 */
export function waitingOn(items: ProgressItem[]): WaitingOn | null {
  const stage = currentStage(items);
  if (stage === null) return null;
  const open = items.filter((i) => i.stage === stage && !isComplete(i.status));
  // Blocked-on-someone-else wins: if any item in the current stage is waiting on
  // a third party, the onboarding is waiting on them, whatever else is open.
  if (open.some((i) => i.waitingOn === 'third_party')) return 'third_party';
  if (open.some((i) => i.waitingOn === 'agency')) return 'agency';
  return open.length ? 'locare' : null;
}

/** Days since anything moved. Drives the portfolio view's "not moving" sort. */
export function daysStalled(items: ProgressItem[], now: Date = new Date()): number {
  const stamps = items
    .map((i) => (i.updatedAt ? new Date(i.updatedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  if (!stamps.length) return 0;
  return Math.max(0, Math.floor((now.getTime() - Math.max(...stamps)) / 86_400_000));
}

export type StageState = 'complete' | 'current' | 'ahead';

/**
 * Where a stage sits relative to the work in hand. ADVISORY, NOT A GATE.
 *
 * `ahead` means an earlier stage still has work in it — worth saying, because
 * the runbook's order exists for reasons (migrating data before the hosts are
 * live wastes the migration). But it does not stop anyone opening the stage or
 * completing an item in it.
 *
 * It used to lock. That was wrong for the people who will actually use this:
 * onboarding stalls on third parties constantly — a DNS controller who has not
 * replied in nine days — and a console that refuses to let a Reseller get on
 * with anything else while they wait is a console they stop opening. The real
 * order is enforced by reality, not by a disabled button.
 */
export function stageState(items: ProgressItem[], stage: number): StageState {
  const mine = items.filter((i) => i.stage === stage);
  if (mine.length && mine.every((i) => isComplete(i.status))) return 'complete';
  const current = currentStage(items);
  return current === stage ? 'current' : 'ahead';
}

/** Per-stage rollup for the detail screen's stage cards. */
export function stageSummaries(items: ProgressItem[]): Array<{
  stage: number; name: string; state: StageState; done: number; total: number; remainingHours: number;
}> {
  return STAGES.map((s) => {
    const mine = items.filter((i) => i.stage === s.stage);
    return {
      stage: s.stage,
      name: s.name,
      state: stageState(items, s.stage),
      done: mine.filter((i) => isComplete(i.status)).length,
      total: mine.length,
      remainingHours: round1(mine.filter((i) => !isComplete(i.status)).reduce((a, i) => a + hours(i.weightHours), 0)),
    };
  });
}

/** Template rows are valid progress rows too — used to price a fresh onboarding. */
export const fromTemplate = (t: TemplateItem[]): ProgressItem[] =>
  t.map((i) => ({ stage: i.stage, status: 'pending' as const, waitingOn: i.waitingOn, weightHours: i.weightHours }));
