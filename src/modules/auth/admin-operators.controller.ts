import {
  BadRequestException, Body, ConflictException, Controller, Get, Param,
  ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentTenant } from './current-tenant.decorator';
import { SessionStore } from './session-store.service';
import { checkRevoke, planGrant } from './platform-admin-rules';

/**
 * Platform-admin: who else is a platform admin (gap R-2).
 *
 * Before this, operator access came only from `PLATFORM_ADMIN_EMAILS`, so both
 * granting and revoking meant editing `.env.prod` and recreating the API
 * container. Revocation being a deploy is the serious half: an operator who
 * left kept their access until someone SSH'd into the box.
 *
 * A revoke kills every session that person holds, on every device, immediately.
 * Stamping the row alone would leave their current token valid until its idle
 * window lapsed — which is exactly the gap this was built to close.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/operators')
export class AdminOperatorsController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly sessions: SessionStore,
  ) {}

  /** Addresses that are admins because of the env var, not because of a grant. */
  private get bootstrapEmails(): string[] {
    return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  private async emailOf(userId: string): Promise<string> {
    const [row] = await this.ds.query('SELECT email FROM users WHERE id = $1', [userId]);
    return (row?.email ?? '').toLowerCase();
  }

  private list(): Promise<any[]> {
    return this.ds.query('SELECT * FROM platform_admins_list()');
  }

  @Get()
  async index(@CurrentTenant() admin: { userId: string }) {
    const [grants, me] = await Promise.all([this.list(), this.emailOf(admin.userId)]);
    return {
      me,
      grants,
      // Shown separately in the UI: these cannot be revoked here, only by
      // editing the environment and redeploying. Saying so is kinder than a
      // button that fails.
      bootstrap: this.bootstrapEmails,
    };
  }

  @Post()
  async grant(@CurrentTenant() admin: { userId: string }, @Body() body: any) {
    const plan = planGrant(body ?? {});
    if (!plan.ok) throw new BadRequestException(plan.error);
    const by = await this.emailOf(admin.userId);
    try {
      await this.ds.query('SELECT platform_admin_grant($1,$2,$3,$4) AS id', [
        plan.value.email, plan.value.name, by, plan.value.note,
      ]);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('ALREADY_ADMIN')) {
        throw new ConflictException(`${plan.value.email} already has platform-admin access.`);
      }
      if (msg.includes('EMAIL_REQUIRED')) throw new BadRequestException('An email address is required.');
      throw e;
    }
    // They may be signed in already as a partner or an agency user; the new
    // rights apply the next time they sign in, which the UI says.
    return { ok: true, email: plan.value.email, grants: await this.list() };
  }

  @Post(':id/revoke')
  async revoke(@CurrentTenant() admin: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    const by = await this.emailOf(admin.userId);
    const grants = await this.list();
    const target = grants.find((g) => g.id === id && !g.revokedAt);
    if (!target) throw new BadRequestException('That access has already been removed.');

    // Checked here so the refusal carries an explanation; enforced again inside
    // the function, under a row lock, so a race cannot get past both.
    const allowed = checkRevoke({
      actorEmail: by,
      targetEmail: target.email,
      activeCount: grants.filter((g) => !g.revokedAt).length,
    });
    if (!allowed.ok) throw new BadRequestException(allowed.error);

    let userId: string;
    try {
      const [row] = await this.ds.query('SELECT platform_admin_revoke($1,$2) AS user_id', [id, by]);
      userId = row?.user_id;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('SELF_REVOKE')) {
        throw new BadRequestException('You cannot remove your own access — ask another admin.');
      }
      if (msg.includes('LAST_ADMIN')) throw new BadRequestException('That is the last platform admin — grant someone else first.');
      if (msg.includes('NOT_ADMIN')) throw new BadRequestException('That access has already been removed.');
      throw e;
    }

    // The point of the whole gap: access ends now, not when a token expires.
    let killed = 0;
    try { killed = await this.sessions.revokeAllForUser(userId); } catch { /* Redis down: the grant is still gone */ }

    return { ok: true, email: target.email, sessionsEnded: killed, grants: await this.list() };
  }
}
