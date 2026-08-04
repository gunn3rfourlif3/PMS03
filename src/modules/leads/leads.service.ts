import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';

export interface CreateLead {
  type?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

/**
 * Captures marketing leads from the public product site and notifies the team.
 * Stored durably in `leads`; an email is sent to LEADS_NOTIFY_EMAIL when the
 * email channel is configured, otherwise the lead is logged.
 */
@Injectable()
export class LeadsService {
  private readonly log = new Logger('Leads');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  async create(input: CreateLead): Promise<{ received: true }> {
    const type = (input.type || 'contact').slice(0, 40);
    await this.ds.query(
      `INSERT INTO leads (type, name, email, phone, company, message, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [type, input.name, input.email, input.phone ?? null, input.company ?? null, input.message ?? null, JSON.stringify(input.meta ?? {})],
    );
    await this.notify(type, input);
    return { received: true };
  }

  private async notify(type: string, l: CreateLead): Promise<void> {
    // Partner registrations ('agent') go to the partner inbox; everything else
    // to the general leads inbox.
    const to = type === 'agent'
      ? (process.env.PARTNER_NOTIFY_EMAIL || 'partners@locare.co.za')
      : process.env.LEADS_NOTIFY_EMAIL;
    const email = this.channels?.get('email');
    const body =
      `New ${type} lead\n\n` +
      `Name: ${l.name}\nEmail: ${l.email}\nPhone: ${l.phone ?? '-'}\n` +
      `Company: ${l.company ?? '-'}\nMessage: ${l.message ?? '-'}`;
    if (to && email) {
      // Replies go straight to the applicant; log both failures AND successes so
      // "form said sent but inbox is empty" is diagnosable from the api logs
      // (provider name + accepted message-id vs. an error).
      const res = await email.send({
        to,
        subject: `New ${type} lead: ${l.name}`,
        body,
        replyTo: { email: l.email, name: l.name },
      });
      if (res.ok) this.log.log(`lead notify sent → ${to} via ${email.constructor.name} (${res.providerRef ?? 'no-ref'})`);
      else this.log.error(`lead notify failed → ${to}: ${res.error ?? 'unknown'}`);
    } else if (!email) {
      this.log.warn(`no email channel configured — ${type} lead not emailed; logged only:\n${body}`);
    } else {
      this.log.warn(`no recipient for ${type} lead (set ${type === 'agent' ? 'PARTNER_NOTIFY_EMAIL' : 'LEADS_NOTIFY_EMAIL'}); logged only:\n${body}`);
    }
  }
}
