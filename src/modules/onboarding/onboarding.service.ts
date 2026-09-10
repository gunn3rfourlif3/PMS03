import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AgencyOnboardingItem, OnboardingStatus, WaitingOn } from './agency-onboarding-item.entity';
import { TEMPLATE, TEMPLATE_VERSION, STAGES, stageName } from './onboarding-template';
import { currentStage, daysStalled, progressOf, stageSummaries, waitingOn } from './onboarding-progress';

const STATUSES: OnboardingStatus[] = ['pending', 'in_progress', 'blocked', 'done', 'skipped', 'failed'];
const WAITING: WaitingOn[] = ['locare', 'agency', 'third_party'];

/**
 * Tracks where each agency is in onboarding (requirements doc R-7).
 *
 * Platform-scoped: no RLS, and every entry point is behind
 * `@Roles('platform_admin')`. Nothing here changes agency data — the console
 * records and reports the onboarding, it does not perform it.
 */
@Injectable()
export class OnboardingService {
  private readonly log = new Logger('Onboarding');
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private repo() { return this.ds.getRepository(AgencyOnboardingItem); }

  /**
   * Create the checklist for an agency from the current template.
   *
   * Idempotent, by the unique index on (vendor_id, item_key): re-running adds
   * items that a newer template introduced and leaves existing rows — and their
   * history — exactly as they are. That is what lets an agency onboarded before
   * this shipped (Dantalan) get a checklist on first open.
   */
  async seed(vendorId: string): Promise<{ created: number; existing: number }> {
    // Via the SECURITY DEFINER function, not `vendors` directly: the console runs
    // outside any tenant context, so RLS hides every row from a direct read.
    const [vendor] = await this.ds.query(`SELECT * FROM platform_agency($1)`, [vendorId]);
    if (!vendor) throw new NotFoundException('Agency not found');

    const existing = new Set(
      (await this.repo().find({ where: { vendorId }, select: ['itemKey'] })).map((i) => i.itemKey),
    );
    const missing = TEMPLATE.filter((t) => !existing.has(t.key));
    if (missing.length) {
      await this.repo().insert(missing.map((t) => ({
        vendorId,
        templateVersion: TEMPLATE_VERSION,
        stage: t.stage,
        itemKey: t.key,
        title: t.title,
        detail: t.detail ?? null,
        status: 'pending' as OnboardingStatus,
        waitingOn: t.waitingOn,
        verifiable: t.verifiable,
        weightHours: t.weightHours,
      })));
      this.log.log(`Seeded ${missing.length} onboarding item(s) for vendor ${vendorId} (${TEMPLATE_VERSION})`);
    }
    return { created: missing.length, existing: existing.size };
  }

  /**
   * Every agency with an onboarding, worst first.
   *
   * Sorted by days stalled rather than by name or date, because the question
   * this screen exists to answer is "what is not moving" — which the
   * requirements doc says is currently unanswerable.
   */
  async portfolio(): Promise<unknown[]> {
    const rows: Array<{ vendorId: string; name: string; slug: string; status: string }> =
      await this.ds.query(`SELECT * FROM platform_onboarding_agencies()`);

    const all = await this.repo().find();
    const byVendor = new Map<string, AgencyOnboardingItem[]>();
    for (const item of all) {
      const list = byVendor.get(item.vendorId) ?? [];
      list.push(item);
      byVendor.set(item.vendorId, list);
    }

    const now = new Date();
    return rows
      .map((v) => {
        const items = byVendor.get(v.vendorId) ?? [];
        const stage = currentStage(items);
        return {
          ...v,
          progress: progressOf(items),
          stage,
          stageName: stage === null ? 'Complete' : stageName(stage),
          waitingOn: waitingOn(items),
          daysStalled: daysStalled(items, now),
          complete: stage === null,
        };
      })
      .sort((a, b) => {
        // Finished onboardings sink; among the rest, longest stalled first.
        if (a.complete !== b.complete) return a.complete ? 1 : -1;
        return b.daysStalled - a.daysStalled;
      });
  }

  /** One agency's full checklist, grouped by stage, with the progress rollup. */
  async detail(vendorId: string): Promise<unknown> {
    const [vendor] = await this.ds.query(`SELECT * FROM platform_agency($1)`, [vendorId]);
    if (!vendor) throw new NotFoundException('Agency not found');

    const items = await this.repo().find({ where: { vendorId }, order: { stage: 'ASC', itemKey: 'ASC' } });
    const stage = currentStage(items);

    return {
      vendor,
      templateVersion: items[0]?.templateVersion ?? TEMPLATE_VERSION,
      seeded: items.length > 0,
      progress: progressOf(items),
      stage,
      stageName: stage === null ? 'Complete' : stageName(stage),
      waitingOn: waitingOn(items),
      daysStalled: daysStalled(items),
      stages: STAGES.map((s) => {
        const summary = stageSummaries(items).find((x) => x.stage === s.stage)!;
        return { ...s, ...summary, items: items.filter((i) => i.stage === s.stage) };
      }),
    };
  }

  /**
   * Update one item.
   *
   * `done` demands a person: the DB constraint requires completed_by and
   * completed_at together, because an anonymous tick brings the handover problem
   * straight back — the whole point is that a second person can see who said
   * this was finished, and when.
   */
  async updateItem(
    vendorId: string,
    itemKey: string,
    userId: string,
    patch: { status?: OnboardingStatus; waitingOn?: WaitingOn; ownerUserId?: string | null; notes?: string | null },
  ): Promise<AgencyOnboardingItem> {
    const item = await this.repo().findOne({ where: { vendorId, itemKey } });
    if (!item) throw new NotFoundException('Checklist item not found');

    if (patch.status !== undefined) {
      if (!STATUSES.includes(patch.status)) throw new BadRequestException('Unknown status');
      if (patch.status === 'done') {
        item.completedBy = userId;
        item.completedAt = new Date();
      } else {
        // Reopening clears the attestation rather than leaving a stale one: the
        // record should not claim someone signed off on the current state.
        item.completedBy = null;
        item.completedAt = null;
      }
      item.status = patch.status;
    }
    if (patch.waitingOn !== undefined) {
      if (!WAITING.includes(patch.waitingOn)) throw new BadRequestException('Unknown waiting_on');
      item.waitingOn = patch.waitingOn;
    }
    if (patch.ownerUserId !== undefined) item.ownerUserId = patch.ownerUserId;
    if (patch.notes !== undefined) item.notes = patch.notes;

    return this.repo().save(item);
  }
}
