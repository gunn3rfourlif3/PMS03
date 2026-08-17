import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PartnerActivity, PartnerDeal, ActivityType } from './partner.entities';
import { isDealStage, isAtOpenLeadCap, openLeadCap, OPEN_STAGES } from './pipeline';

@Injectable()
export class PartnerDealsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private deals() { return this.ds.getRepository(PartnerDeal); }
  private activities() { return this.ds.getRepository(PartnerActivity); }

  private assert(partnerId?: string | null): string {
    if (!partnerId) throw new ForbiddenException('No partner context');
    return partnerId;
  }

  /** Every deal read/write is scoped to the caller's partner id. */
  private async own(partnerId: string, dealId: string): Promise<PartnerDeal> {
    const d = await this.deals().findOne({ where: { id: dealId, partnerId } });
    if (!d) throw new NotFoundException('Deal not found');
    return d;
  }

  list(partnerId?: string | null): Promise<PartnerDeal[]> {
    return this.deals().find({ where: { partnerId: this.assert(partnerId) }, order: { updatedAt: 'DESC' } });
  }

  /** Open, unconverted prospects a partner is holding right now. */
  async openLeadCount(partnerId: string): Promise<number> {
    const [r] = await this.ds.query(
      `SELECT COUNT(*)::int AS n FROM partner_deals WHERE partner_id = $1 AND stage = ANY($2)`,
      [partnerId, OPEN_STAGES],
    );
    return Number(r?.n) || 0;
  }

  async create(partnerId: string | null | undefined, input: Partial<PartnerDeal>): Promise<PartnerDeal> {
    const id = this.assert(partnerId);
    if (!input.prospectName?.trim()) throw new BadRequestException('Prospect name is required.');

    // Applies to self-registered prospects only. Deals created by the referral
    // link (signup_agency) are already-converted signups, not reservations.
    const cap = openLeadCap();
    if (isAtOpenLeadCap(await this.openLeadCount(id), cap)) {
      throw new BadRequestException(
        `You already have ${cap} open prospects. Close or mark some as lost before registering more.`,
      );
    }

    const repo = this.deals();
    const d = repo.create({
      partnerId: id,
      prospectName: input.prospectName.trim(),
      contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone,
      stage: input.stage && isDealStage(input.stage) ? input.stage : 'lead',
      expectedUnits: Number(input.expectedUnits) || 0,
      expectedMrr: Number(input.expectedMrr) || 0,
      source: 'manual',
    });
    const saved = await repo.save(d);
    await this.log(id, 'note', `Added deal "${saved.prospectName}"`, saved.id);
    return saved;
  }

  async update(partnerId: string | null | undefined, dealId: string, patch: Partial<PartnerDeal>): Promise<PartnerDeal> {
    const id = this.assert(partnerId);
    const d = await this.own(id, dealId);
    for (const k of ['prospectName', 'contactName', 'contactEmail', 'contactPhone', 'lostReason'] as const) {
      if (patch[k] !== undefined) (d as any)[k] = patch[k];
    }
    if (patch.expectedUnits !== undefined) d.expectedUnits = Number(patch.expectedUnits) || 0;
    if (patch.expectedMrr !== undefined) d.expectedMrr = Number(patch.expectedMrr) || 0;
    return this.deals().save(d);
  }

  async moveStage(partnerId: string | null | undefined, dealId: string, stage: string, lostReason?: string): Promise<PartnerDeal> {
    const id = this.assert(partnerId);
    if (!isDealStage(stage)) throw new BadRequestException('Invalid stage.');
    const d = await this.own(id, dealId);
    const from = d.stage;
    d.stage = stage;
    d.stageChangedAt = new Date();
    if (stage === 'lost') d.lostReason = lostReason ?? d.lostReason;
    const saved = await this.deals().save(d);
    await this.log(id, 'stage_change', `${d.prospectName}: ${from} → ${stage}`, d.id);
    return saved;
  }

  // ── Activity ──────────────────────────────────────────────────────────────
  activityFeed(partnerId?: string | null): Promise<PartnerActivity[]> {
    return this.activities().find({ where: { partnerId: this.assert(partnerId) }, order: { createdAt: 'DESC' }, take: 50 });
  }

  log(partnerId: string, type: ActivityType, summary: string, dealId?: string): Promise<PartnerActivity> {
    const repo = this.activities();
    return repo.save(repo.create({ partnerId, type, summary, dealId }));
  }

  async logActivity(partnerId: string | null | undefined, input: { type: ActivityType; summary?: string; dealId?: string }): Promise<PartnerActivity> {
    const id = this.assert(partnerId);
    if (input.dealId) await this.own(id, input.dealId); // ownership check
    return this.log(id, input.type, input.summary ?? '', input.dealId);
  }

  /** Global leaderboard (read-only aggregate; safe cross-partner exposure). */
  async leaderboard(): Promise<unknown[]> {
    const [row] = await this.ds.query(`SELECT partner_leaderboard() AS d`);
    const d = row?.d;
    return (typeof d === 'string' ? JSON.parse(d) : d) ?? [];
  }
}
