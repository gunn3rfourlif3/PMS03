import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { renderEmail, EmailItem } from '@common/email/email';
import { CHANGELOG, CATEGORY_COLOR, CATEGORY_LABEL, ChangelogEntry, entryById, unsentEntries } from './changelog-entries';
import { countBySource, dedupeRecipients, fromEnvList, Recipient } from './changelog-recipients';
import { CHANNEL_PROVIDERS, Channel, ChannelProvider } from '@providers/notification/notification-provider.interface';

/** Spelled out reads better in a heading: "Three updates for you". */
const WORDS: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
};

const LOCARE_EMAIL_LOGO =
  process.env.LOCARE_EMAIL_LOGO_URL || 'https://locare.co.za/brand/locare-logo-email-white.png';

/**
 * Product updates for the people who sell Locare.
 *
 * Entries are written in the repo alongside the change; this decides who hears
 * about them and records what has already gone out. Sending is a deliberate,
 * human act — there is no scheduler here on purpose. An email to every partner
 * cannot be recalled, and the cost of getting one wrong was demonstrated the
 * morning the applicant email was still quoting pre-reprice commission.
 */
@Injectable()
export class ChangelogService {
  private readonly log = new Logger('Changelog');
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  private async sentIds(): Promise<string[]> {
    const rows = await this.ds.query(`SELECT entry_id FROM changelog_sends`);
    return rows.map((r: { entry_id: string }) => r.entry_id);
  }

  /** Everything, with what has been sent marked — the admin screen's payload. */
  async list(): Promise<unknown> {
    const sent = await this.ds.query(
      `SELECT entry_id, sent_at, recipients FROM changelog_sends`,
    );
    const byId = new Map(sent.map((s: any) => [s.entry_id, s]));
    const recipients = await this.recipients();
    return {
      entries: CHANGELOG.map((e) => ({
        ...e,
        categoryLabel: CATEGORY_LABEL[e.category],
        sentAt: (byId.get(e.id) as any)?.sent_at ?? null,
        sentTo: (byId.get(e.id) as any)?.recipients ?? null,
      })),
      unsentCount: unsentEntries(byId.keys() as Iterable<string>).length,
      recipientCount: recipients.length,
      recipientsBySource: countBySource(recipients),
    };
  }

  /**
   * The live distribution list.
   *
   * Read fresh every time rather than stored: a partner suspended yesterday
   * should not get today's update, and a partner approved this morning should.
   */
  async recipients(): Promise<Recipient[]> {
    const partners: Array<{ email: string }> = await this.ds.query(
      `SELECT contact_email AS email FROM partners
        WHERE status = 'active' AND nullif(btrim(contact_email), '') IS NOT NULL`,
    );
    const applicants: Array<{ email: string }> = await this.ds.query(
      `SELECT contact_email AS email FROM partner_applications
        WHERE status = 'approved' AND nullif(btrim(contact_email), '') IS NOT NULL`,
    );
    return dedupeRecipients([
      ...partners.map((p) => ({ email: p.email, source: 'partner' as const })),
      ...applicants.map((a) => ({ email: a.email, source: 'applicant' as const })),
      ...fromEnvList(process.env.PLATFORM_ADMIN_EMAILS, 'admin'),
      ...fromEnvList(process.env.CHANGELOG_EXTRA_RECIPIENTS, 'extra'),
    ]);
  }

  /** Exactly what will be sent, for the approval screen. Sends nothing. */
  async preview(ids: string[]): Promise<{ subject: string; html: string; text: string; recipientCount: number }> {
    const entries = this.resolve(ids);
    const recipients = await this.recipients();
    return { ...this.render(entries), recipientCount: recipients.length };
  }

  /**
   * Send one update covering the given entries, then record them as sent.
   *
   * Recorded per entry AFTER the send, and only for entries that actually went
   * out — an entry marked sent by a failed run is one nobody ever hears about,
   * which is the worse of the two failure modes.
   */
  async send(ids: string[], userId: string): Promise<{ sent: number; recipients: number; failed: number }> {
    const entries = this.resolve(ids);
    const alreadySent = new Set(await this.sentIds());
    const fresh = entries.filter((e) => !alreadySent.has(e.id));
    if (!fresh.length) throw new BadRequestException('Those updates have already been sent.');

    const recipients = await this.recipients();
    if (!recipients.length) throw new BadRequestException('Nobody to send to — no active partners or configured recipients.');

    const provider = this.channels?.get('email');
    if (!provider) throw new BadRequestException('No email channel is configured.');

    const { subject, html, text } = this.render(fresh);
    let delivered = 0;
    let failed = 0;
    // One email each rather than a bcc blob: a partner update is a personal
    // message, and a bounce should name the address it failed for.
    for (const r of recipients) {
      try {
        const res = await provider.send({ to: r.email, subject, body: text, html });
        if (res.ok) delivered += 1; else { failed += 1; this.log.warn(`changelog to ${r.email} failed: ${res.error ?? 'unknown'}`); }
      } catch (e: any) {
        failed += 1;
        this.log.warn(`changelog to ${r.email} threw: ${e.message}`);
      }
    }

    if (delivered > 0) {
      for (const e of fresh) {
        await this.ds.query(
          `INSERT INTO changelog_sends (entry_id, sent_by, recipients, subject)
           VALUES ($1,$2,$3,$4) ON CONFLICT (entry_id) DO NOTHING`,
          [e.id, userId, delivered, subject],
        );
      }
    }
    this.log.log(`Changelog "${subject}" → ${delivered} delivered, ${failed} failed, ${fresh.length} entr(ies) marked sent`);
    return { sent: fresh.length, recipients: delivered, failed };
  }

  private resolve(ids: string[]): ChangelogEntry[] {
    if (!ids?.length) throw new BadRequestException('Pick at least one update to send.');
    const entries = ids.map((id) => {
      const e = entryById(id);
      if (!e) throw new BadRequestException(`Unknown update: ${id}`);
      return e;
    });
    // Newest first, so the email reads the way the list does.
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  /** The email itself. Locare-branded; no agency branding — this is our mail. */
  private render(entries: ChangelogEntry[]): { subject: string; html: string; text: string } {
    const subject = entries.length === 1
      ? `Locare update — ${entries[0].title}`
      : `Locare update — ${entries.length} changes that affect how you sell`;

    // A numbered digest, not prose sections: these are independent things, and
    // the count up front tells someone how much there is before they commit.
    const items: EmailItem[] = entries.map((e) => ({
      label: CATEGORY_LABEL[e.category],
      labelColor: CATEGORY_COLOR[e.category],
      title: e.title,
      body: e.body,
      // `action`, not `callout`: callout sets its value at 26px because it is for
      // one number, and a sentence through it reads as a shout.
      ...(e.action ? { action: { label: 'What to do', text: e.action } } : {}),
    }));

    const count = entries.length === 1 ? 'One update' : `${WORDS[entries.length] ?? entries.length} updates`;
    const intro = 'Everything here changes what you say on a call, or what you get paid.';

    const text = [
      'LOCARE UPDATE',
      '',
      intro,
      '',
      ...entries.flatMap((e, i) => [
        `${i + 1}.`,
        `${CATEGORY_LABEL[e.category].toUpperCase()} — ${e.title}`,
        e.body,
        ...(e.action ? [`What to do: ${e.action}`] : []),
        '',
      ]),
      'Questions? Just reply to this email.',
    ].join('\n');

    const html = renderEmail({
      logoUrl: LOCARE_EMAIL_LOGO,
      headerStyle: 'ink',
      eyebrow: 'Partner update',
      heading: `${count} for you`,
      preheader: entries[0].title,
      paragraphs: [intro],
      items,
      footerNote: 'Questions, or something here that does not match what you are seeing? Just reply.',
    });

    return { subject, html, text };
  }
}
