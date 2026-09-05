import { Injectable, Logger, Optional, Inject, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resolveMx } from 'node:dns/promises';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';
import { renderEmail } from '@common/email/email';

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
 *
 * The lead row is written BEFORE the notification and the notification never
 * throws, so a broken mail path loses nothing — `leads` is the record, email is
 * only the alert.
 */
@Injectable()
export class LeadsService implements OnModuleInit {
  private readonly log = new Logger('Leads');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  /**
   * A notify address on a domain with no MX is indistinguishable from a working
   * one at send time: the relay accepts the message and the bounce arrives
   * later, somewhere else entirely. Nine demo leads went to a placeholder
   * address on a mail-less domain before anyone noticed, so resolve the
   * configured recipients once at boot — where a wrong answer is visible in the
   * startup log next to the `channels — …` line, not weeks later.
   *
   * Deliberately non-fatal: a DNS blip at boot must not stop the API serving.
   */
  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.checkRecipient('LEADS_NOTIFY_EMAIL', process.env.LEADS_NOTIFY_EMAIL),
      this.checkRecipient('PARTNER_NOTIFY_EMAIL', process.env.PARTNER_NOTIFY_EMAIL || 'partners@locare.co.za'),
    ]);
  }

  private async checkRecipient(name: string, addr?: string): Promise<void> {
    if (!addr) {
      this.log.warn(`${name} is not set — those leads are stored and logged, never emailed`);
      return;
    }
    const domain = addr.split('@')[1];
    if (!domain) {
      this.log.error(`${name}="${addr}" is not an email address — leads to it cannot be sent`);
      return;
    }
    try {
      const mx = await resolveMx(domain);
      if (!mx.length) throw new Error('no MX records');
      this.log.log(`${name} → ${addr} (${domain} MX ok)`);
    } catch (e: any) {
      this.log.error(
        `${name}="${addr}" — ${domain} has no reachable MX (${e.code ?? e.message}). ` +
          `Mail to it will be accepted by the relay and bounce out of band, so the send will ` +
          `look successful in these logs. Fix the address or leads will silently go nowhere.`,
      );
    }
  }

  async create(input: CreateLead): Promise<{ received: true }> {
    const type = (input.type || 'contact').slice(0, 40);
    await this.ds.query(
      `INSERT INTO leads (type, name, email, phone, company, message, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [type, input.name, input.email, input.phone ?? null, input.company ?? null, input.message ?? null, JSON.stringify(input.meta ?? {})],
    );
    await this.notify(type, input);
    await this.acknowledge(type, input);
    return { received: true };
  }

  /**
   * Confirms receipt to the person who submitted the form.
   *
   * The site promises "we'll reach out to get you started" and then, until now,
   * said nothing until Arthur replied by hand — so a slow reply read as no
   * reply. This buys that time back and gives someone not yet ready to talk the
   * walkthrough to watch instead.
   *
   * Not sent for 'agent' (partner registrations), which have their own staged
   * application emails and would otherwise get two messages for one form.
   *
   * Never throws and never blocks the caller's success: the lead row is already
   * committed, and a failed courtesy email must not turn a captured lead into a
   * 500 for the submitter.
   */
  private async acknowledge(type: string, l: CreateLead): Promise<void> {
    if (type === 'agent') return;
    if (process.env.LEADS_ACK === 'off') return;
    const email = this.channels?.get('email');
    if (!email || !l.email?.includes('@')) return;

    const fromEmail = process.env.LEADS_ACK_FROM?.trim();
    const fromName = process.env.LEADS_ACK_FROM_NAME?.trim() || 'Locare';
    const replyTo = process.env.LEADS_ACK_REPLY_TO?.trim() || fromEmail;
    const demoUrl = process.env.LEADS_ACK_DEMO_URL?.trim() || 'https://locare.co.za/demo';
    const posterUrl = process.env.LEADS_ACK_POSTER_URL?.trim() || 'https://locare.co.za/demo/poster.jpg';
    const logoUrl = process.env.LEADS_ACK_LOGO_URL?.trim() || 'https://locare.co.za/brand/locare-logo-email-white.png';
    const first = (l.name ?? '').trim().split(/\s+/)[0] || 'there';

    const intro =
      `Thanks for getting in touch about Locare — this is just to confirm it arrived. ` +
      `${fromName === 'Locare' ? 'We' : 'I'}'ll come back to you within one working day.`;
    const watch = `While you wait, here is a two-minute walkthrough: the back-office, the tenant app and the landlord app, all under an agency's own brand.`;
    const offer = `If it's easier, reply to this email with a time that suits you and we'll do twenty minutes on a call instead.`;

    // Plain text is not a formality — it is what a text-only client and most
    // spam filters actually read, and the link must survive without the poster.
    const body =
      `Hi ${first},\n\n${intro}\n\n${watch}\n${demoUrl}\n\n${offer}\n\n` +
      `${fromName}\nLocare (Pty) Ltd · locare.co.za`;

    const html = renderEmail({
      heading: `Thanks, ${first} — we have your details`,
      preheader: 'A two-minute walkthrough while you wait for our reply.',
      // No eyebrow: the header already carries the wordmark, and "Locare" twice
      // in one bar reads as a template someone forgot to fill in.
      logoUrl,
      headerStyle: 'ink', // the email wordmark is the white variant
      paragraphs: [intro, watch],
      media: {
        imageUrl: posterUrl,
        href: demoUrl,
        alt: 'Watch the two-minute Locare walkthrough',
        caption: 'Two minutes · back-office, tenant app, landlord app',
      },
      buttons: [{ label: 'Watch the walkthrough', url: demoUrl }],
      footerNote: offer,
      fineprint:
        `You are receiving this because you asked to hear from Locare at locare.co.za. ` +
        `Reply "no thanks" and we will not contact you again.`,
    });

    try {
      const res = await email.send({
        to: l.email,
        subject: 'Thanks — we got your details',
        body,
        html,
        ...(fromEmail ? { from: { email: fromEmail, name: fromName } } : {}),
        ...(replyTo ? { replyTo: { email: replyTo, name: fromName } } : {}),
      });
      if (res.ok) this.log.log(`lead ack accepted → ${l.email} (${res.providerRef ?? 'no-ref'})`);
      else this.log.warn(`lead ack rejected → ${l.email}: ${res.error ?? 'unknown'}`);
    } catch (e: any) {
      this.log.warn(`lead ack threw for ${l.email}: ${e.message}`);
    }
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
      // The lead row is already committed, so a mail failure must not surface as
      // a 500 to the submitter — that would report a captured lead as lost.
      try {
        const res = await email.send({
          to,
          subject: `New ${type} lead: ${l.name}`,
          body,
          replyTo: { email: l.email, name: l.name },
        });
        // "accepted", not "sent": all the relay promises is that it took the
        // message. Saying more than we know is what hid a dead notify address
        // for a fortnight.
        if (res.ok) {
          this.log.log(`lead notify accepted → ${to} by ${email.constructor.name} (${res.providerRef ?? 'no-ref'})`);
        } else {
          this.log.error(`lead notify rejected → ${to}: ${res.error ?? 'unknown'} — lead is safe in the leads table`);
        }
      } catch (e: any) {
        this.log.error(`lead notify threw → ${to}: ${e.message} — lead is safe in the leads table:\n${body}`);
      }
    } else if (!email) {
      this.log.warn(`no email channel configured — ${type} lead not emailed; logged only:\n${body}`);
    } else {
      this.log.warn(`no recipient for ${type} lead (set ${type === 'agent' ? 'PARTNER_NOTIFY_EMAIL' : 'LEADS_NOTIFY_EMAIL'}); logged only:\n${body}`);
    }
  }
}
