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
import { PartnerApplication, ApplicationDocument, PartnerApplicationType } from './partner-application.entity';

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

@Injectable()
export class PartnerApplicationsService {
  private readonly log = new Logger('PartnerApplications');
  private readonly tokenTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 days to finish + upload docs

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

  // ── Public ────────────────────────────────────────────────────────────────

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
    if (app.status !== 'draft' && app.status !== 'info_requested')
      throw new ForbiddenException('This application can no longer be edited.');
  }

  async addDocument(id: string, token: string, docType: string, file?: UploadedFileLike): Promise<{ documents: ApplicationDocument[] }> {
    const app = await this.load(id);
    this.assertEditable(app, token);
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('Upload a PDF or an image (JPG/PNG).');
    const { url } = await this.media.saveProof(file);
    const doc: ApplicationDocument = { docType: String(docType || 'other'), url, name: file.originalname ?? 'document', uploadedAt: new Date().toISOString() };
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
      .select(['a.id', 'a.type', 'a.contactName', 'a.contactEmail', 'a.companyName', 'a.fullName', 'a.status', 'a.createdAt', 'a.reviewedAt'])
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

  // ── Notifications (email via the configured channel) ─────────────────────────

  private async email(to: string | undefined, subject: string, body: string, html?: string): Promise<void> {
    const provider = this.channels?.get('email');
    if (!to || !provider) return;
    const res = await provider.send({ to, subject, body, html });
    if (!res.ok) this.log.error(`email to ${to} failed: ${res.error ?? 'unknown'}`);
  }

  private notifyTeam(app: PartnerApplication): Promise<void> {
    const who = app.type === 'business' ? app.companyName : app.fullName;
    return this.email(TEAM_EMAIL(), `New partner application: ${who ?? app.contactEmail}`,
      `A new ${app.type} partner application was submitted.\n\nName: ${who ?? '-'}\nContact: ${app.contactName ?? '-'} (${app.contactEmail})\n\nReview it in Admin → Partners → Applications.`);
  }

  private notifyApplicant(app: PartnerApplication, kind: 'approved' | 'rejected' | 'info_requested', token?: string): Promise<void> {
    const first = (app.contactName || app.fullName || 'there').split(' ')[0];
    if (kind === 'approved') {
      return this.email(app.contactEmail, 'Your Locare partner application is approved 🎉',
        `Hi ${first}, your partner application has been approved. Sign in at ${APPLY_URL().replace('/partner-apply', '')} with this email to access your partner portal.`,
        renderEmail({ heading: `Welcome aboard, ${first}!`, paragraphs: ['Your partner application has been approved.', 'Sign in with this email address to access your partner dashboard, pipeline and commissions.'], buttons: [{ label: 'Sign in', url: APPLY_URL().replace('/partner-apply', '') }] }));
    }
    if (kind === 'rejected') {
      return this.email(app.contactEmail, 'Update on your Locare partner application',
        `Hi ${first}, thank you for your interest. After review we're unable to approve your partner application at this time.${app.decisionReason ? `\n\nNote: ${app.decisionReason}` : ''}`);
    }
    const link = `${APPLY_URL()}?id=${app.id}&token=${encodeURIComponent(token ?? '')}`;
    return this.email(app.contactEmail, 'We need a bit more for your Locare partner application',
      `Hi ${first}, we need some additional information to continue.${app.decisionReason ? `\n\n${app.decisionReason}` : ''}\n\nContinue your application: ${link}`,
      renderEmail({ heading: 'A little more needed', paragraphs: [app.decisionReason || 'We need some additional information to continue your application.'], buttons: [{ label: 'Continue application', url: link }] }));
  }
}
