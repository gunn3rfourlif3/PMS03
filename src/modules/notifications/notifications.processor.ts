import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import {
  QUEUE_NOTIFICATIONS,
  JOB_SEND_NOTIFICATION,
} from '@common/queue/queue.constants';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import {
  CHANNEL_PROVIDERS,
  Channel,
  ChannelProvider,
} from '@providers/notification/notification-provider.interface';
import { emailBrandForVendor, agencySender } from '@common/email/email-brand';
import { TEMPLATES, renderTemplate, TemplateKey } from './templates';
import { allowedChannels, NotificationPrefs } from './preferences';
import { Notification } from './notification.entity';
import { NotificationPreference } from './notification-preference.entity';
import { NotifyInput } from './notifications.service';

/**
 * Async multi-channel fan-out. Per job: resolve recipient + preferences
 * (per-vendor via TenantRunner), compute allowed channels (opt-outs + quiet
 * hours), render the template, deliver on each channel, and log per-channel.
 */
@Processor(QUEUE_NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantRunner: TenantRunner,
    private readonly tenant: TenantContextService,
    @Inject(CHANNEL_PROVIDERS)
    private readonly providers: Map<Channel, ChannelProvider>,
  ) {
    super();
  }

  async process(job: Job): Promise<{ sent: number }> {
    if (job.name !== JOB_SEND_NOTIFICATION) return { sent: 0 };
    const input = job.data as NotifyInput;

    return this.tenantRunner.runInVendorContext(input.vendorId, async () => {
      const destination = input.destination ?? (await this.resolveDestination(input.userId));
      if (!destination) {
        this.logger.warn(`No destination for user ${input.userId}; skipping`);
        return { sent: 0 };
      }

      const prefs = await this.resolvePrefs(input.userId);
      const requested = input.channels ?? TEMPLATES[input.template as TemplateKey].defaultChannels;
      const channels = allowedChannels(requested, prefs, new Date().getUTCHours());

      // Resolved per job rather than cached: an agency can change its logo or
      // colour at any time, and mail is low-volume enough that one extra row
      // read per send is not worth a cache-invalidation problem.
      const brand = await emailBrandForVendor(this.tenant.getManager(), input.vendorId);

      // Every template greets "Hi {{name}}", and no caller puts a name in the
      // payload — so every tenant was being greeted "Hi ,". Resolved here, once,
      // from the recipient; a caller that does pass a name keeps it.
      const payload = { ...input.payload, name: input.payload?.name || (await this.resolveName(input.userId)) || 'there' };

      const { subject, body, html } = renderTemplate(
        input.template as TemplateKey,
        payload,
        brand,
      );
      const repo = this.tenant.getRepository(Notification);

      let sent = 0;
      for (const channel of channels) {
        const provider = this.providers.get(channel);
        const row = repo.create({
          vendorId: input.vendorId,
          userId: input.userId,
          channel,
          template: input.template,
          destination,
          payload: input.payload,
          status: 'queued',
        });
        if (!provider) {
          row.status = 'failed';
          row.error = `No provider for channel ${channel}`;
        } else {
          const res = await provider.send({
            to: destination, subject, body,
            ...(channel === 'email' ? { html, ...agencySender(brand) } : {}),
          });
          row.status = res.ok ? 'sent' : 'failed';
          row.providerRef = res.providerRef;
          row.error = res.error;
          row.sentAt = res.ok ? new Date() : undefined;
          if (res.ok) sent += 1;
        }
        await repo.save(row);
      }
      return { sent };
    });
  }

  /** First name only: "Hi Thandi," not "Hi Thandi Mokoena,". */
  private async resolveName(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const rows = await this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [userId]);
    const name = String(rows[0]?.name ?? '').trim();
    return name ? name.split(/\s+/)[0] : undefined;
  }

  private async resolveDestination(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const rows = await this.dataSource.query(
      `SELECT COALESCE(email, phone) AS dest FROM users WHERE id = $1`,
      [userId],
    );
    return rows[0]?.dest ?? undefined;
  }

  private async resolvePrefs(userId?: string): Promise<NotificationPrefs> {
    const empty: NotificationPrefs = { optedOut: [] };
    if (!userId) return empty;
    const pref = await this.tenant
      .getRepository(NotificationPreference)
      .findOne({ where: { userId } });
    if (!pref) return empty;
    return { optedOut: pref.optedOut ?? [], quietHours: pref.quietHours };
  }
}
