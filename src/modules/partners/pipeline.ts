import { DealStage } from './partner.entities';

/** The partner sales funnel (from the mockup, repurposed for software sales). */
export const DEAL_STAGES: DealStage[] = ['lead', 'contacted', 'demo', 'trial', 'proposal', 'won', 'lost'];

export const OPEN_STAGES: DealStage[] = ['lead', 'contacted', 'demo', 'trial', 'proposal'];

export function isDealStage(s: string): s is DealStage {
  return (DEAL_STAGES as string[]).includes(s);
}

/** Total pipeline value = expected MRR of all still-open deals. */
export function pipelineValue(deals: { stage: DealStage; expectedMrr: number | string }[]): number {
  return deals
    .filter((d) => (OPEN_STAGES as string[]).includes(d.stage))
    .reduce((sum, d) => sum + (Number(d.expectedMrr) || 0), 0);
}
