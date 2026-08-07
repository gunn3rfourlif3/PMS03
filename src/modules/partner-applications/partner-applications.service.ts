import {
  BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { MediaService, UploadedFileLike } from '@modules/media/media.service';
import { PartnersService } from '@modules/partners/partners.service';
import { maskBanking } from '@common/security/pii-crypto';
import { toE164 } from '@common/phone/e164';
import { CHANNEL_PROVIDERS, Channel, ChannelProvider } from '@providers/notification/notification-provider.interface';
import { KYC_PROVIDER, KycProvider } from '@providers/kyc/kyc-provider.interface';
import { renderEmail } from '@common/email/email';
import {
  PartnerApplication, ApplicationDocument, PartnerApplicationType, PartnerApplicationStatus,
} from './partner-application.entity';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const APPLY_URL = () => (process.env.PARTNER_APPLY_URL || 'https://app.locare.co.za/partner-apply').replace(/\/+$/, '');
const TEAM_EMAIL = () => process.env.PARTNER_NOTIFY_EMAIL || 'partners@locare.co.za';

export interface CreateApplicationInput {
  type: PartnerApplicationType;
  contactName?: string; contactEmail: string; contactPhone?: string;
  fullName?: string; idType?: 'sa_id' | 'passport'; idNumber?: string; dob?: string; residentialAddress?: string;
  companyName?: string; registrationNumber?: string; vatNumber?: string; businessAddress?: string;
  directors?: Array<{ name?: string; idNumber?: string }>;
  banking?: { bankName?: string; accountHolder?: string; accountNumber?: string; branchCode?: string; accountType?: string };
  agreedTerms?: boolean;
}

/** Stage 1 — all we ask for before emailing the KYC link. */
export interface StartApplicationInput {
  contactName?: string; contactEmail: string; contactPhone?: string;
}

/** Stage 2 — the vetting detail, saved against an existing draft. Everything is
 *  optional: the form saves progressively and completeness is enforced on submit. */
export type SaveDetailsInput = Partial<CreateApplicationInput>;

@Injectable()
export class PartnerApplicationsService {
  private readonly log = new Logger('PartnerApplications');
  // Applicants often need to dig out an ID doc and a bank confirmation letter, so
  // the link is deliberately long-lived.
  private readonly tokenTtlMs =
    1000 * 60 * 60 * 24 * Math.max(1, Number(process.env.PARTNER_APP_LINK_DAYS ?? 14));

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly media: MediaService,
    private readonly partnersService: PartnersService,
    @Inject(KYC_PROVIDER) private readonly kyc: KycProvider,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  private repo(): Repository<PartnerApplication> { return this.ds.getRepository(PartnerApplication); }
  private hashToken(t: string) { return createHash('sha256').update(t).digest('hex'); }
  private newToken() { return randomBytes(24).toString('base64url'); }
  private async load(id: string): Promise<PartnerApplication> {
    const app = await this.repo().findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  // ── Public: stage 1 (contact only) ────────────────────────────────────────

  /**
   * Stage 1 of the partner application: contact details only.
   *
   * Asking for ID numbers, directors and banking up front deterred applicants,
   * so we capture just enough to reach them and email a link to finish the
   * vetting. The token is deliberately NOT returned to the browser — the
   * applicant must open the emailed link, which doubles as email verification.
   */
  async start(input: StartApplicationInput): Promise<{ id: string; emailed: boolean }> {
    const contactEmail = input.contactEmail?.trim().toLowerCase();
    if (!contactEmail) throw new BadRequestException('A contact email is required.');

    // Someone re-applying with the same email while a draft is still open should
    // land back in the same application rather than create a duplicate lead.
    const existing = await this.repo().findOne({
      where: [
        { contactEmail, status: 'started' as PartnerApplicationStatus },
        { contactEmail, status: 'draft' as PartnerApplicationStatus },
      ],
      order: { createdAt: 'DESC' },
    });

    const token = this.newToken();
    const app = existing ?? this.repo().create({
      // Type is chosen in stage 2; default to the commonest case for now.
      type: 'individual' as PartnerApplicationType,
      contactEmail,
      status: 'started' as PartnerApplicationStatus,
      sensitive: {}, banking: {}, documents: [], risk: {},
      agreedTerms: false,
    });
    app.contactName = input.contactName?.trim() || app.contactName;
    app.contactPhone = input.contactPhone
      ? (toE164(input.contactPhone) ?? input.contactPhone.trim())
      : app.contactPhone;
    app.uploadTokenHash = this.hashToken(token);
    app.uploadTokenExpires = new Date(Date.now() + this.tokenTtlMs);
    const saved = await this.repo().save(app);

    await this.notifyApplicant(saved, 'start', token);
    if (!existing) await this.notifyTeamOfLead(saved);
    this.log.log(`Partner lead ${saved.id} started (${contactEmail})`);
    return { id: saved.id, emailed: true };
  }

  /** Load a draft for stage 2. Non-sensitive fields only — enough to prefill. */
  async resume(id: string, token: string): Promise<Record<string, unknown>> {
    const app = await this.load(id);
    this.assertEditable(app, token);
    const s = app.sensitive as any;
    return {
      id: app.id,
      status: app.status,
      type: app.type,
      contactName: app.contactName, contactEmail: app.contactEmail, contactPhone: app.contactPhone,
      fullName: app.fullName, idType: app.idType, residentialAddress: app.residentialAddress,
      companyName: app.companyName, registrationNumber: app.registrationNumber,
      vatNumber: app.vatNumber, businessAddress: app.businessAddress,
      directors: s?.directors ?? [],
      banking: app.banking ?? {},
      agreedTerms: app.agreedTerms,
      documents: (app.documents ?? []).map((d) => ({ docType: d.docType, name: d.name, uploadedAt: d.uploadedAt })),
      // Surfaced so stage 2 can explain why they were sent back here.
      decisionReason: app.status === 'info_requested' ? app.decisionReason : undefined,
      expiresAt: app.uploadTokenExpires,
    };
  }

  /** Save stage-2 vetting details against an open draft. Partial + repeatable. */
  async saveDetails(id: string, token: string, input: SaveDetailsInput): Promise<{ status: string }> {
    const app = await this.load(id);
    this.assertEditable(app, token);
    if (input.type && input.type !== 'individual' && input.type !== 'business')
      throw new BadRequestException('Choose individual or business.');

    if (input.type) app.type = input.type;
    if (input.contactName !== undefined) app.contactName = input.contactName?.trim();
    if (input.contactPhone !== undefined)
      app.contactPhone = input.contactPhone ? (toE164(input.contactPhone) ?? input.contactPhone.trim()) : undefined;
    if (input.fullName !== undefined) app.fullName = input.fullName?.trim();
    if (input.idType !== undefined) app.idType = input.idType;
    if (input.residentialAddress !== undefined) app.residentialAddress = input.residentialAddress?.trim();
    if (input.companyName !== undefined) app.companyName = input.companyName?.trim();
    if (input.registrationNumber !== undefined) app.registrationNumber = input.registrationNumber?.trim();
    if (input.vatNumber !== undefined) app.vatNumber = input.vatNumber?.trim();
    if (input.businessAddress !== undefined) app.businessAddress = input.businessAddress?.trim();

    // Merge rather than replace: stage 2 saves incrementally, and a later step
    // must not wipe PII captured by an earlier one.
    const nextSensitive = this.cleanSensitive(input as CreateApplicationInput);
    if (Object.keys(nextSensitive).length) app.sensitive = { ...(app.sensitive ?? {}), ...nextSensitive };
    if (input.banking) app.banking = { ...(app.banking ?? {}), ...input.banking };
    if (input.agreedTerms !== undefined) {
      app.agreedTerms = !!input.agreedTerms;
      if (input.agreedTerms && !app.consentAt) app.consentAt = new Date();
    }

    // First real edit promotes the lead to a proper draft.
    if (app.status === 'started') app.status = 'draft';
    await this.repo().save(app);
    return { status: app.status };
  }

  // ── Public: legacy single-shot create (kept for API compatibility) ────────

  /** Start a draft application; returns an upload token the applicant uses to add
   *  documents and submit without a login. */
  async create(input: CreateApplicationInput): Promise<{ id: string; uploadToken: string }> {
    if (input.type !== 'individual' && input.type !== 'business') throw new BadRequestException('Choose individual or business.');
    if (!input.contactEmail?.trim()) throw new BadRequestException('A contact email is required.');
    const token = this.newToken();
    const saved = await this.repo().save(this.repo().create({
      type: input.type,
      contactName: input.contactName?.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      contactPhone: input.contactPhone ? (toE164(input.contactPhone) ?? input.contactPhone.trim()) : undefined,
      fullName: input.fullName?.trim(),
      idType: input.idType,
      residentialAddress: input.residentialAddress?.trim(),
      companyName: input.companyName?.trim(),
      registrationNumber: input.registrationNumber?.trim(),
      vatNumber: input.vatNumber?.trim(),
      businessAddress: input.businessAddress?.trim(),
      sensitive: this.cleanSensitive(input),
      banking: input.banking ?? {},
      agreedTerms: !!input.agreedTerms,
      consentAt: input.agreedTerms ? new Date() : undefined,
      status: 'draft',
      documents: [],
      risk: {},
      uploadTokenHash: this.hashToken(token),
      uploadTokenExpires: new Date(Date.now() + this.tokenTtlMs),
    }));
    return { id: saved.id, uploadToken: token };
  }

  private cleanSensitive(i: CreateApplicationInput): Record<string, unknown> {
    const s: Record<string, unknown> = {};
    if (i.idNumber) s.idNumber = i.idNumber.trim();
    if (i.dob) s.dob = i.dob;
    if (i.directors?.length) s.directors = i.directors.filter((d) => d?.name || d?.idNumber);
    return s;
  }

  private assertEditable(app: PartnerApplication, token?: string): void {
    if (!app.uploadTokenHash || !app.uploadTokenExpires || app.uploadTokenExpires.getTime() < Date.now())
      throw new ForbiddenException('This application link has expired.');
    if (!token || this.hashToken(token) !== app.uploadTokenHash)
      throw new ForbiddenException('Invalid application link.');
    if (app.status !== 'started' && app.status !== 'draft' && app.status !== 'info_requested')
      throw new ForbiddenException('This application can no longer be edited.');
  }

  async addDocument(id: string, token: string, docType: string, file?: UploadedFileLike): Promise<{ documents: ApplicationDocument[] }> {
    const app = await this.load(id);
    this.assertEditable(app, token);
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('Upload a PDF or an image (JPG/PNG).');
    const { url, key } = await this.media.saveProof(file);
    const doc: ApplicationDocument = { docType: String(docType || 'other'), url, key, name: file.originalname ?? 'document', uploadedAt: new Date().toISOString() };
    app.documents = [...(app.documents ?? []), doc];
    await this.repo().save(app);
    return { documents: app.documents };
  }

  /** Finalise: validate completeness, run provider pre-checks, notify the team. */
  async submit(id: string, token: string): Promise<{ status: string }> {
    const app = await this.load(id);
    this.assertEditable(app, token);
    this.validateComplete(app);
    app.status = 'submitted';
    if (!app.consentAt && app.agreedTerms) app.consentAt = new Date();
    app.uploadTokenHash = undefined; // burn — no edits after submit
    app.uploadTokenExpires = undefined;
    app.risk = await this.runChecks(app);
    await this.repo().save(app);
    await this.notifyTeam(app);
    return { status: app.status };
  }

  private validateComplete(app: PartnerApplication): void {
    const missing: string[] = [];
    if (!app.agreedTerms) missing.push('consent to terms');
    const has = (t: string) => (app.documents ?? []).some((d) => d.docType === t);
    if (app.type === 'individual') {
      if (!app.fullName) missing.push('full name');
      if (!app.idType) missing.push('ID type');
      if (!(app.sensitive as any)?.idNumber) missing.push('ID/passport number');
      if (!app.residentialAddress) missing.push('residential address');
      if (!has('id_document')) missing.push('ID document');
      if (!has('proof_of_address')) missing.push('proof of address');
      if (!has('bank_confirmation')) missing.push('bank confirmation letter');
    } else {
      if (!app.companyName) missing.push('company name');
      if (!app.registrationNumber) missing.push('company registration number');
      if (!app.businessAddress) missing.push('business address');
      if (!((app.sensitive as any)?.directors?.length)) missing.push('at least one director');
      if (!has('company_registration')) missing.push('company registration document');
      if (!has('bank_confirmation')) missing.push('bank confirmation letter');
    }
    const bank = app.banking as any;
    if (!bank?.accountNumber || !bank?.bankName) missing.push('banking details');
    if (missing.length) throw new BadRequestException(`Please complete: ${missing.join(', ')}.`);
  }

  private async runChecks(app: PartnerApplication): Promise<Record<string, unknown>> {
    try {
      const s = app.sensitive as any;
      const r = app.type === 'individual'
        ? await this.kyc.verifyIndividual({ fullName: app.fullName, idType: app.idType, idNumber: s?.idNumber, dob: s?.dob })
        : await this.kyc.verifyBusiness({ companyName: app.companyName, registrationNumber: app.registrationNumber, vatNumber: app.vatNumber, directors: s?.directors });
      return { ...r, provider: this.kyc.name, checkedAt: new Date().toISOString() };
    } catch (e: any) {
      this.log.warn(`KYC pre-check failed: ${e.message}`);
      return { mode: 'manual', passed: null, error: e.message };
    }
  }

  // ── Platform admin ──────────────────────────────────────────────────────────

  list(status?: string): Promise<PartnerApplication[]> {
    const qb = this.repo().createQueryBuilder('a')
      // contactPhone + reminderSentAt included so the queue is actionable for
      // 'started' leads that have no KYC detail yet.
      .select(['a.id', 'a.type', 'a.contactName', 'a.contactEmail', 'a.contactPhone', 'a.companyName', 'a.fullName', 'a.status', 'a.createdAt', 'a.reviewedAt', 'a.reminderSentAt'])
      .orderBy('a.createdAt', 'DESC').take(200);
    if (status && status !== 'all') qb.where('a.status = :status', { status });
    return qb.getMany();
  }

  /** Full detail for review: sensitive PII shown (to match against documents),
   *  banking masked. Platform-admin only. */
  async detail(id: string): Promise<Record<string, unknown>> {
    const a = await this.load(id);
    return {
      id: a.id, type: a.type, status: a.status,
      contact: { name: a.contactName, email: a.contactEmail, phone: a.contactPhone },
      individual: a.type === 'individual' ? { fullName: a.fullName, idType: a.idType, idNumber: (a.sensitive as any)?.idNumber, dob: (a.sensitive as any)?.dob, residentialAddress: a.residentialAddress } : undefined,
      business: a.type === 'business' ? { companyName: a.companyName, registrationNumber: a.registrationNumber, vatNumber: a.vatNumber, businessAddress: a.businessAddress, directors: (a.sensitive as any)?.directors ?? [] } : undefined,
      banking: maskBanking(a.banking as any),
      documents: a.documents ?? [],
      risk: a.risk ?? {},
      consentAt: a.consentAt,
      review: { reviewedBy: a.reviewedBy, reviewedAt: a.reviewedAt, decisionReason: a.decisionReason, riskNotes: a.riskNotes },
      partnerId: a.partnerId,
      createdAt: a.createdAt,
    };
  }

  async review(id: string, adminId: string): Promise<{ status: string }> {
    const app = await this.load(id);
    if (app.status === 'submitted') { app.status = 'under_review'; app.reviewedBy = adminId; await this.repo().save(app); }
    return { status: app.status };
  }

  /** Approve → provision the real partner + login. Idempotent. */
  async approve(id: string, adminId: string, opts: { commissionRate?: number; commissionMonths?: number | null }): Promise<{ partnerId: string }> {
    const app = await this.load(id);
    if (app.status === 'approved' && app.partnerId) return { partnerId: app.partnerId };
    if (app.status === 'rejected') throw new BadRequestException('This application was rejected.');
    const name = app.type === 'business' ? (app.companyName || app.contactName || 'Partner') : (app.fullName || app.contactName || 'Partner');
    const partner = await this.partnersService.createPartner({
      name, contactEmail: app.contactEmail, contactPhone: app.contactPhone, company: app.companyName,
      commissionRate: opts.commissionRate, commissionMonths: opts.commissionMonths ?? null,
    });
    await this.partnersService.addMember(partner.id, app.contactEmail, name);
    app.status = 'approved'; app.partnerId = partner.id; app.reviewedBy = adminId; app.reviewedAt = new Date();
    app.uploadTokenHash = undefined; app.uploadTokenExpires = undefined;
    await this.repo().save(app);
    await this.notifyApplicant(app, 'approved');
    this.log.log(`Application ${id} approved → partner ${partner.id}`);
    return { partnerId: partner.id };
  }

  async reject(id: string, adminId: string, reason?: string): Promise<{ status: string }> {
    const app = await this.load(id);
    app.status = 'rejected'; app.decisionReason = reason?.trim() || undefined;
    app.reviewedBy = adminId; app.reviewedAt = new Date();
    app.uploadTokenHash = undefined; app.uploadTokenExpires = undefined;
    await this.repo().save(app);
    await this.notifyApplicant(app, 'rejected');
    return { status: app.status };
  }

  /** Ask the applicant for more/corrected info — re-opens uploads with a fresh token. */
  async requestInfo(id: string, adminId: string, note?: string): Promise<{ status: string }> {
    const app = await this.load(id);
    const token = this.newToken();
    app.status = 'info_requested'; app.decisionReason = note?.trim() || undefined;
    app.reviewedBy = adminId; app.reviewedAt = new Date();
    app.uploadTokenHash = this.hashToken(token); app.uploadTokenExpires = new Date(Date.now() + this.tokenTtlMs);
    await this.repo().save(app);
    await this.notifyApplicant(app, 'info_requested', token);
    return { status: app.status };
  }

  /** Re-issue the stage-2 link (admin action, or self-serve if the link lapsed). */
  async resendLink(id: string): Promise<{ emailed: boolean }> {
    const app = await this.load(id);
    if (!['started', 'draft', 'info_requested'].includes(app.status))
      throw new BadRequestException('This application is no longer open.');
    const token = this.newToken();
    app.uploadTokenHash = this.hashToken(token);
    app.uploadTokenExpires = new Date(Date.now() + this.tokenTtlMs);
    await this.repo().save(app);
    await this.notifyApplicant(app, 'start', token);
    return { emailed: true };
  }

  /**
   * Single nudge to applicants who gave us their contact details but never
   * finished KYC. Runs on a schedule; `reminder_sent_at` makes it send once only.
   * Each reminder carries a fresh token (we only store the hash, so the original
   * can't be re-sent) and therefore also extends their window.
   */
  async sendReminders(afterHours = Number(process.env.PARTNER_APP_REMINDER_HOURS ?? 48)): Promise<{ sent: number }> {
    const cutoff = new Date(Date.now() - Math.max(1, afterHours) * 3_600_000);
    const due = await this.repo().createQueryBuilder('a')
      .where('a.status IN (:...statuses)', { statuses: ['started', 'draft'] })
      .andWhere('a.reminder_sent_at IS NULL')
      .andWhere('a.created_at < :cutoff', { cutoff })
      .take(200)
      .getMany();

    let sent = 0;
    for (const app of due) {
      try {
        const token = this.newToken();
        app.uploadTokenHash = this.hashToken(token);
        app.uploadTokenExpires = new Date(Date.now() + this.tokenTtlMs);
        app.reminderSentAt = new Date();
        await this.repo().save(app);
        await this.notifyApplicant(app, 'reminder', token);
        sent += 1;
      } catch (e: any) {
        this.log.warn(`reminder for application ${app.id} failed: ${e.message}`);
      }
    }
    if (sent) this.log.log(`Sent ${sent} partner-application reminder(s)`);
    return { sent };
  }

  // ── Retention (POPIA) ────────────────────────────────────────────────────────

  /**
   * Purge personal data from applications rejected more than `days` ago (default
   * 90). Clears the document references + encrypted PII (ID numbers, banking) from
   * the row, keeping only the shell (status/decision) for audit. Idempotent — the
   * `documents <> '[]'` guard means an already-purged row is skipped. Returns the
   * number of applications scrubbed.
   */
  async purgeRejectedDocuments(days = Number(process.env.PARTNER_APP_RETENTION_DAYS ?? 90)): Promise<{ purged: number }> {
    const cutoff = new Date(Date.now() - Math.max(1, days) * 86_400_000);
    const rows = await this.ds.query(
      `UPDATE partner_applications
         SET documents = '[]'::jsonb, sensitive = '{}'::jsonb, banking = '{}'::jsonb, updated_at = now()
       WHERE status = 'rejected' AND reviewed_at IS NOT NULL AND reviewed_at < $1
         AND documents <> '[]'::jsonb
       RETURNING id`,
      [cutoff],
    );
    const purged = rows?.length ?? 0;
    if (purged) this.log.log(`Purged PII from ${purged} rejected partner application(s) older than ${days}d`);
    return { purged };
  }

  // ── Notifications (email via the configured channel) ─────────────────────────

  private async email(to: string | undefined, subject: string, body: string, html?: string): Promise<void> {
    const provider = this.channels?.get('email');
    if (!to) { this.log.warn(`skipped email — no recipient (subject: ${subject})`); return; }
    if (!provider) { this.log.warn(`skipped email to ${to} — no email channel configured`); return; }
    const res = await provider.send({ to, subject, body, html });
    if (res.ok) this.log.log(`email sent → ${to} via ${provider.constructor.name} (${res.providerRef ?? 'no-ref'})`);
    else this.log.error(`email to ${to} failed: ${res.error ?? 'unknown'}`);
  }

  private notifyTeam(app: PartnerApplication): Promise<void> {
    const who = app.type === 'business' ? app.companyName : app.fullName;
    return this.email(TEAM_EMAIL(), `New partner application: ${who ?? app.contactEmail}`,
      `A new ${app.type} partner application was submitted.\n\nName: ${who ?? '-'}\nContact: ${app.contactName ?? '-'} (${app.contactEmail})\n\nReview it in Admin → Partners → Applications.`);
  }

  private notifyTeamOfLead(app: PartnerApplication): Promise<void> {
    return this.email(TEAM_EMAIL(), `New partner enquiry: ${app.contactName ?? app.contactEmail}`,
      `Someone started a partner application.\n\nName: ${app.contactName ?? '-'}\nEmail: ${app.contactEmail}\nPhone: ${app.contactPhone ?? '-'}\n\nThey've been emailed a link to complete KYC. Track it in Admin → Partners → Applications.`);
  }

  /** The stage-2 link. Continues the application without a login. */
  private continueUrl(app: PartnerApplication, token?: string): string {
    return `${APPLY_URL()}/continue?id=${app.id}&token=${encodeURIComponent(token ?? '')}`;
  }

  private notifyApplicant(
    app: PartnerApplication,
    kind: 'approved' | 'rejected' | 'info_requested' | 'start' | 'reminder',
    token?: string,
  ): Promise<void> {
    const first = (app.contactName || app.fullName || 'there').split(' ')[0];

    if (kind === 'start' || kind === 'reminder') {
      const link = this.continueUrl(app, token);
      const days = Math.round(this.tokenTtlMs / 86_400_000);
      const heading = kind === 'start' ? `Thanks, ${first} — one more step` : `Still interested, ${first}?`;
      const intro = kind === 'start'
        ? 'Thanks for your interest in the Locare partner programme.'
        : "You started a partner application with us but haven't finished it yet.";
      return this.email(
        app.contactEmail,
        kind === 'start' ? 'Complete your Locare partner application' : 'Finish your Locare partner application',
        `Hi ${first}, ${intro}\n\nTo finish, we need to verify who you are (KYC/KYB). Have your ID or company registration and banking details ready — it takes a few minutes.\n\nContinue here: ${link}\n\nThis link is valid for ${days} days.`,
        renderEmail({
          heading,
          paragraphs: [
            intro,
            'To complete it we need to verify who you are. Have your ID document (or company registration) and your banking details to hand — it only takes a few minutes.',
            `This link stays valid for ${days} days.`,
          ],
          buttons: [{ label: 'Complete your application', url: link }],
        }),
      );
    }

    if (kind === 'approved') {
      return this.email(app.contactEmail, 'Your Locare partner application is approved 🎉',
        `Hi ${first}, your partner application has been approved. Sign in at ${APPLY_URL().replace('/partner-apply', '')} with this email to access your partner portal.`,
        renderEmail({ heading: `Welcome aboard, ${first}!`, paragraphs: ['Your partner application has been approved.', 'Sign in with this email address to access your partner dashboard, pipeline and commissions.'], buttons: [{ label: 'Sign in', url: APPLY_URL().replace('/partner-apply', '') }] }));
    }
    if (kind === 'rejected') {
      return this.email(app.contactEmail, 'Update on your Locare partner application',
        `Hi ${first}, thank you for your interest. After review we're unable to approve your partner application at this time.${app.decisionReason ? `\n\nNote: ${app.decisionReason}` : ''}`);
    }
    const link = this.continueUrl(app, token);
    return this.email(app.contactEmail, 'We need a bit more for your Locare partner application',
      `Hi ${first}, we need some additional information to continue.${app.decisionReason ? `\n\n${app.decisionReason}` : ''}\n\nContinue your application: ${link}`,
      renderEmail({ heading: 'A little more needed', paragraphs: [app.decisionReason || 'We need some additional information to continue your application.'], buttons: [{ label: 'Continue application', url: link }] }));
  }
}
