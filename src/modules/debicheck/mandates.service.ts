import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { DebitMandate } from './debit-mandate.entity';
import { canTransition, MandateState } from './mandate-calc';
import { ConsentWebhookResult, requiresTenantFallbackNotice } from './consent-webhook';
import { NotificationsService } from '@modules/notifications/notifications.service';

export interface ApplyConsentOutcome {
  matched: boolean;
  from?: MandateState;
  to?: MandateState;
  /** True when rent has stopped collecting and the tenant must be told (§11.9). */
  tenantFallbackRequired?: boolean;
  note?: string;
}

@Injectable()
export class MandatesService {
  private readonly log = new Logger('DebiCheckMandates');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly tenant: TenantContextService,
    private readonly tenantRunner: TenantRunner,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Resolve the owning vendor without a session. RLS hides everything from an
   * unauthenticated webhook, so the vendor is fetched through the narrow
   * SECURITY DEFINER lookups and all real work happens inside tenant context.
   */
  private async vendorFor(result: ConsentWebhookResult): Promise<string | undefined> {
    const isUuid = (v?: string) =>
      !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    if (isUuid(result.externalReference)) {
      const [r] = await this.ds.query('SELECT mandate_vendor_by_id($1) AS v', [result.externalReference]);
      if (r?.v) return r.v;
    }
    if (result.providerRef) {
      const [r] = await this.ds.query('SELECT mandate_vendor_by_provider_ref($1) AS v', [result.providerRef]);
      if (r?.v) return r.v;
    }
    return undefined;
  }

  /**
   * Apply a consent status change to its mandate.
   *
   * Idempotent: Svix retries, and a repeated GRANTED must not append history
   * twice or re-fire notifications. An illegal transition is refused and logged
   * rather than forced — the state machine is the audit trail, and quietly
   * overwriting it would hide a provider or ordering bug.
   */
  async applyConsent(result: ConsentWebhookResult): Promise<ApplyConsentOutcome> {
    if (!result.state) return { matched: false, note: result.detail };

    const vendorId = await this.vendorFor(result);
    if (!vendorId) {
      this.log.error(
        `Consent webhook matched no mandate. external=${result.externalReference} provider=${result.providerRef}`,
      );
      return { matched: false, note: 'no matching mandate' };
    }

    return this.tenantRunner.runInVendorContext(vendorId, async () => {
      const repo = this.tenant.getRepository(DebitMandate);
      const mandate = result.externalReference
        ? await repo.findOne({ where: { id: result.externalReference } })
          ?? await repo.findOne({ where: { providerMandateRef: result.providerRef } })
        : await repo.findOne({ where: { providerMandateRef: result.providerRef } });

      if (!mandate) return { matched: false, note: 'no matching mandate in tenant context' };

      const from = mandate.state;
      const to = result.state!;

      if (from === to) {
        // Replay. Still worth capturing the provider ref if this is the first
        // delivery that carried it.
        if (result.providerRef && !mandate.providerMandateRef) {
          mandate.providerMandateRef = result.providerRef;
          await repo.save(mandate);
        }
        return { matched: true, from, to, note: 'already in this state' };
      }

      if (!canTransition(from, to)) {
        this.log.warn(`Refused illegal mandate transition ${from} → ${to} for ${mandate.id} (${result.detail})`);
        return { matched: true, from, to, note: `illegal transition ${from} → ${to}` };
      }

      mandate.state = to;
      mandate.statusReason = result.statusReason ?? mandate.statusReason;
      if (result.providerRef) mandate.providerMandateRef = result.providerRef;
      if (to === 'active' && !mandate.authenticatedAt) mandate.authenticatedAt = new Date();
      if (to === 'cancelled' || to === 'rejected' || to === 'expired') mandate.cancelledAt = new Date();

      mandate.history = [
        ...(mandate.history ?? []),
        {
          at: new Date().toISOString(),
          from,
          to,
          reason: result.statusReason ?? null,
          source: 'stitch-consent-webhook',
          ...(result.mandateReferenceNumber ? { mandateReferenceNumber: result.mandateReferenceNumber } : {}),
        },
      ];
      await repo.save(mandate);

      const tenantFallbackRequired = requiresTenantFallbackNotice(from, to);
      this.log.log(
        `Mandate ${mandate.id} ${from} → ${to}${result.statusReason ? ` (${result.statusReason})` : ''}`,
      );

      if (tenantFallbackRequired) {
        // Best-effort: a notification failure must not fail the webhook, or Svix
        // retries and we re-apply a transition that already succeeded. The
        // mandate state is the source of truth; the message is a side effect.
        await this.notifyCollectionStopped(mandate, to, result.statusReason)
          .catch((e) => this.log.error(`Mandate ${mandate.id}: fallback notices failed — ${e.message}`));
      }

      return { matched: true, from, to, tenantFallbackRequired };
    });
  }

  /**
   * §11.9 — the mandate stopped, so rent no longer collects itself.
   *
   * Both sides are told, and the tenant's message is the one that matters: an
   * unnotified tenant does nothing, misses the month, and is then chased by
   * dunning for an administrative event they had no part in.
   *
   * Runs inside the caller's tenant context, so every read here is RLS-scoped.
   */
  private async notifyCollectionStopped(
    mandate: DebitMandate,
    state: MandateState,
    statusReason?: string,
  ): Promise<void> {
    const [ctx] = await this.tenant.getManager().query(
      `SELECT u.id   AS tenant_user_id,
              u.name AS tenant_name,
              p.name AS property_name,
              l.rent_amount
         FROM leases l
         LEFT JOIN users u ON u.id = l.tenant_id
         LEFT JOIN units un ON un.id = l.unit_id
         LEFT JOIN properties p ON p.id = un.property_id
        WHERE l.id = $1`,
      [mandate.leaseId],
    );

    const dueDay = mandate.collectionDay ?? 1;
    const payload = {
      name: ctx?.tenant_name ?? 'there',
      tenantName: ctx?.tenant_name ?? 'the tenant',
      propertyName: ctx?.property_name ?? 'your property',
      currency: 'ZAR',
      amount: Number(ctx?.rent_amount ?? 0).toFixed(2),
      dueDate: `day ${dueDay} of next month`,
      state,
      // Rendered inline, so it needs its own leading separator or the sentence
      // runs together when there is no reason.
      reasonSuffix: statusReason ? ` (${statusReason})` : '',
      payUrl: process.env.TENANT_APP_URL?.trim() || 'https://app.locare.co.za',
      leaseUrl: `${(process.env.SIGN_BASE ?? '').replace(/\/+$/, '')}/leases/${mandate.leaseId}`,
      payLink: '',
    };

    if (ctx?.tenant_user_id) {
      await this.notifications.enqueue({
        vendorId: mandate.vendorId,
        userId: ctx.tenant_user_id,
        template: 'DEBIT_ORDER_STOPPED',
        payload,
      });
    } else {
      // No linked user means no way to reach them — surface it rather than
      // letting the tenant silently go unnotified.
      this.log.error(`Mandate ${mandate.id}: no tenant user on lease ${mandate.leaseId}; tenant NOT notified`);
    }

    // Staff side. Routed to the vendor's owners rather than a single user, so
    // it lands even if the person who set the mandate up has left.
    const staff: Array<{ user_id: string }> = await this.tenant.getManager().query(
      `SELECT user_id FROM memberships
        WHERE vendor_id = $1 AND role IN ('vendor_owner','property_manager') AND status = 'active'`,
      [mandate.vendorId],
    );
    await Promise.all(
      staff.map((s) =>
        this.notifications.enqueue({
          vendorId: mandate.vendorId,
          userId: s.user_id,
          template: 'DEBIT_ORDER_STOPPED_AGENCY',
          payload,
        }),
      ),
    );
  }
}
