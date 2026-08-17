import { DealStage } from './partner.entities';

/** The partner sales funnel (from the mockup, repurposed for software sales). */
export const DEAL_STAGES: DealStage[] = ['lead', 'contacted', 'demo', 'trial', 'proposal', 'won', 'lost'];

export const OPEN_STAGES: DealStage[] = ['lead', 'contacted', 'demo', 'trial', 'proposal'];

export function isDealStage(s: string): s is DealStage {
  return (DEAL_STAGES as string[]).includes(s);
}

/**
 * Cap on simultaneously open, unconverted prospects per partner
 * (docs/LOCARE_COMMISSION_STRUCTURE.md §7).
 *
 * Lead registration exists so two partners do not collide on the same agency.
 * Uncapped it becomes a land grab: register every agency in a metro and collect
 * on whichever later signs organically, having done nothing. Twenty is well
 * above what anyone genuinely working a pipeline holds at once.
 */
export const OPEN_LEAD_CAP_DEFAULT = 20;

export function openLeadCap(): number {
  const n = Number(process.env.PARTNER_OPEN_LEAD_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : OPEN_LEAD_CAP_DEFAULT;
}

export function isAtOpenLeadCap(openCount: number, cap: number = openLeadCap()): boolean {
  return (Number(openCount) || 0) >= cap;
}

/** Total pipeline value = expected MRR of all still-open deals. */
export function pipelineValue(deals: { stage: DealStage; expectedMrr: number | string }[]): number {
  return deals
    .filter((d) => (OPEN_STAGES as string[]).includes(d.stage))
    .reduce((sum, d) => sum + (Number(d.expectedMrr) || 0), 0);
}
