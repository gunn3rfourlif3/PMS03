import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { LeasingService } from '@modules/leasing/leasing.service';
import { PropertiesService } from '@modules/properties/properties.service';
import { IdentityService } from '@modules/identity/identity.service';
import { InvoiceService } from '@modules/billing/invoice.service';
import { prorateFirstMonth } from '@modules/billing/invoice-calc';
import { LeaseAgreementService } from '@modules/lease-agreement/lease-agreement.service';
import { MediaService } from '@modules/media/media.service';
import { renderEmail } from '@common/email/email';
import { emailBrandForVendor } from '@common/email/email-brand';
import { buildMoveInLines, renderMoveInInvoice } from './move-in-invoice';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';
import { Listing } from './listing.entity';
import { Application, ApplicationStatus } from './application.entity';
import { screen, ScreeningInput } from './screening';
import { canTransition } from './application-transitions';

export interface ApplyInput {
  listingId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  details?: Record<string, unknown>;
}

/** Minimum age to apply / hold a lease. */
export const MIN_APPLICANT_AGE = 18;

/** Whole years old on `asOf` for an ISO date, or null if unparseable. */
export function ageFromDob(dobIso?: string, asOf: Date = new Date()): number | null {
  if (!dobIso) return null;
  const d = new Date(dobIso);
  if (isNaN(d.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age -= 1;
  return age;
}

/** Derive YYYY-MM-DD from a 13-digit SA ID number (YYMMDD…); undefined otherwise. */
export function saIdToDob(id?: string): string | undefined {
  const digits = (id ?? '').replace(/\D/g, '');
  if (digits.length !== 13) return undefined;
  const yy = +digits.slice(0, 2), mm = +digits.slice(2, 4), dd = +digits.slice(4, 6);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  const cutoff = new Date().getFullYear() % 100;
  const century = yy <= cutoff ? 2000 : 1900;
  return `${century + yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly tenantRunner: TenantRunner,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly leasing: LeasingService,
    private readonly properties: PropertiesService,
    private readonly identity: IdentityService,
    private readonly invoices: InvoiceService,
    private readonly leaseAgreements: LeaseAgreementService,
    private readonly media: MediaService,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  /** Manager: all applications for the vendor. */
  list(): Promise<Application[]> {
    return this.tenant.getRepository(Application).find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Public submission: no auth/vendor context. Resolve the published listing's
   * vendor via a SECURITY DEFINER function, then insert inside that vendor's
   * tenant context (RLS-safe).
   */
  async apply(input: ApplyInput): Promise<Application> {
    // Age gate: applicants (and therefore lease signatories) must be 18+.
    // Prefer the stated date of birth; fall back to a 13-digit SA ID number.
    const details = input.details ?? {};
    const dob = (details.dateOfBirth as string) || saIdToDob(details.idNumber as string);
    const age = ageFromDob(dob);
    if (age === null) {
      throw new BadRequestException('Please provide your date of birth so we can confirm your age.');
    }
    if (age < MIN_APPLICANT_AGE) {
      throw new BadRequestException(`You must be at least ${MIN_APPLICANT_AGE} years old to apply.`);
    }

    const rows = await this.dataSource.query(
      'SELECT public_listing_vendor($1) AS vendor_id',
      [input.listingId],
    );
    const vendorId: string | undefined = rows[0]?.vendor_id;
    if (!vendorId) throw new NotFoundException('Listing not open for applications');

    return this.tenantRunner.runInVendorContext(vendorId, async () => {
      const repo = this.tenant.getRepository(Application);
      return repo.save(
        repo.create({
          vendorId,
          listingId: input.listingId,
          applicantName: input.applicantName,
          applicantEmail: input.applicantEmail,
          applicantPhone: input.applicantPhone,
          details: input.details ?? {},
          status: 'submitted',
        }),
      );
    });
  }

  async screenApplication(applicationId: string, input: Omit<ScreeningInput, 'rent'>): Promise<Application> {
    const { app, listing } = await this.load(applicationId);
    this.assertTransition(app.status, 'screening');
    const result = screen({ ...input, rent: Number(listing.advertisedRent) });
    app.status = 'screening';
    app.screeningResult = { ...result };
    return this.tenant.getRepository(Application).save(app);
  }

  async reject(applicationId: string): Promise<Application> {
    const { app } = await this.load(applicationId);
    this.assertTransition(app.status, 'rejected');
    app.status = 'rejected';
    return this.tenant.getRepository(Application).save(app);
  }

  async withdraw(applicationId: string): Promise<Application> {
    const { app } = await this.load(applicationId);
    this.assertTransition(app.status, 'withdrawn');
    app.status = 'withdrawn';
    return this.tenant.getRepository(Application).save(app);
  }

  async approve(applicationId: string, startDate: string): Promise<Application> {
    const { app, listing } = await this.load(applicationId);
    this.assertTransition(app.status, 'approved');

    // Approved, but NOT granted app access yet: the membership is created
    // 'pending' and only activated once the tenant signs their lease.
    const tenantUserId = await this.identity.ensureTenantUser(
      app.applicantEmail, app.applicantName, app.applicantPhone, 'pending',
    );

    const lease = await this.leasing.createLease({
      unitId: listing.unitId,
      tenantId: tenantUserId,
      rentAmount: Number(listing.advertisedRent),
      startDate,
    });

    await this.properties.setUnitStatus(listing.unitId, 'occupied');
    await this.tenant.getRepository(Listing).save({ ...listing, status: 'filled' });

    app.status = 'approved';
    app.leaseId = lease.id;
    const saved = await this.tenant.getRepository(Application).save(app);
    this.logger.debug(`Application ${app.id} approved -> lease ${lease.id}, unit occupied`);

    const period = startDate.slice(0, 7);                 // 'YYYY-MM'
    const pr = prorateFirstMonth(Number(listing.advertisedRent), startDate);
    const rentLabel = pr.prorated
      ? `Rent ${period} (pro-rata ${pr.days}/${pr.daysInMonth} days)`
      : `Rent ${period}`;

    // (d) Render the branded move-in invoice document (rent + admin fee + deposit)
    // first, so both the invoice email and the welcome email can link to it.
    let invoiceUrl: string | undefined;
    try {
      invoiceUrl = await this.renderMoveInInvoice(app, listing, startDate, pr.amount, rentLabel);
    } catch (e: any) {
      this.logger.error(`Move-in invoice for lease ${lease.id} failed: ${e.message}`);
    }

    // (b) Raise the first rent invoice (ledger). Its email links to the rendered
    // document above. Tolerant of failure so a billing hiccup never blocks approval.
    try {
      await this.invoices.generateRentInvoice({
        leaseId: lease.id, tenantId: tenantUserId, period, dueDate: startDate,
        rentAmount: pr.amount, description: rentLabel, documentUrl: invoiceUrl,
      });
    } catch (e: any) {
      this.logger.error(`First invoice for lease ${lease.id} failed: ${e.message} (run billing manually)`);
    }

    // (c) Generate the lease agreement first (no email of its own — the welcome
    // email below carries the sign link) so the applicant gets a single message.
    let signUrl: string | undefined;
    try {
      const res = await this.leaseAgreements.createForLease({
        leaseId: lease.id,
        tenantId: tenantUserId,
        unitId: listing.unitId,
        tenantName: app.applicantName,
        tenantEmail: app.applicantEmail,
        tenantIdNumber: (app.details as any)?.idNumber,
        rentAmount: Number(listing.advertisedRent),
        startDate,
        sendEmail: false,
      });
      signUrl = res.signUrl;
    } catch (e: any) {
      this.logger.error(`Lease agreement generation failed: ${e.message}`);
    }

    // (a) Welcome the applicant: the next step is to SIGN their lease (which
    // unlocks portal access). Include the move-in invoice to view. No sign-in
    // link yet — access is granted only once the lease is signed.
    await this.notifyApproved(app, listing, startDate, invoiceUrl, signUrl).catch((e) =>
      this.logger.error(`Approval notification failed: ${e.message}`),
    );

    return saved;
  }

  /** Email/SMS the applicant that they're approved, with sign-in instructions. */
  /**
   * Render the move-in invoice (first month's rent + admin fee + deposit) as a
   * branded HTML document and store it. Returns the public URL, or undefined if
   * there was nothing to bill. Pure pricing/HTML lives in ./move-in-invoice.
   */
  private async renderMoveInInvoice(
    app: Application, listing: Listing, startDate: string, rentAmount: number, rentLabel: string,
  ): Promise<string | undefined> {
    const deposit = Number(listing.deposit) || 0;
    const adminFee = Number(listing.adminFee) || 0;
    const { lines, total } = buildMoveInLines({ rent: rentAmount, rentLabel, adminFee, deposit });

    const [unitRow] = await this.tenant.getManager().query(
      `SELECT u.label AS "unitLabel", p.name AS "propertyName", p.address AS address
       FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = $1`,
      [listing.unitId],
    );
    const [vendorRow] = await this.tenant.getManager().query(
      `SELECT name, config FROM vendors WHERE id = $1`, [this.tenant.vendorId],
    );
    const config = typeof vendorRow?.config === 'string' ? JSON.parse(vendorRow.config) : (vendorRow?.config ?? {});
    const branding = config?.branding ?? {};
    const contact = branding.contact ?? {};
    const addr = unitRow?.address;
    const addressText = addr && typeof addr === 'object'
      ? [addr.line1, addr.street, addr.suburb, addr.city, addr.province].filter(Boolean).join(', ')
      : (typeof addr === 'string' ? addr : '');

    const html = renderMoveInInvoice({
      invoiceNo: `MI-${Date.now().toString(36).toUpperCase()}`,
      issuedOn: new Date().toISOString().slice(0, 10),
      dueDate: startDate,
      startDate,
      agencyName: vendorRow?.name ?? 'Your agency',
      agencyEmail: contact.email,
      agencyPhone: contact.phone,
      brandColor: branding.brandColor || branding.brand,
      logoUrl: branding.logo?.imageUrl,
      tenantName: app.applicantName,
      tenantEmail: app.applicantEmail,
      propertyName: unitRow?.propertyName,
      unitLabel: unitRow?.unitLabel,
      addressText,
      lines,
      total,
      depositIncluded: deposit > 0,
      payUrl: process.env.TENANT_APP_URL?.trim() || undefined,
    });

    const { url } = await this.media.saveHtml(html);
    return url;
  }

  private async notifyApproved(
    app: Application, listing: Listing, startDate: string, invoiceUrl?: string, signUrl?: string,
  ): Promise<void> {
    if (!this.channels) return;
    const isEmail = !!app.applicantEmail;
    const to = app.applicantEmail || app.applicantPhone;
    if (!to) return;
    const provider = this.channels.get(isEmail ? 'email' : 'sms');
    if (!provider) return;

    const firstName = app.applicantName?.trim().split(/\s+/)[0];
    const greeting = firstName ? `Welcome home, ${firstName}!` : 'Welcome home!';

    // Sign off with the agency's name, and dress the email in their logo and
    // colour (vendor is RLS-scoped to the caller here).
    const brand = await emailBrandForVendor(this.tenant.getManager(), this.tenant.vendorId);
    const agency = (brand.agencyName ?? '').trim();

    // The one required next step is signing the lease — that unlocks portal
    // access. Portal sign-in is intentionally NOT offered here.
    const signLine = signUrl
      ? `\n\nYour next step is to review and sign your lease agreement here:\n${signUrl}\n\nOnce it's signed, your resident portal is unlocked and you can sign in to pay rent, log maintenance and message our team.`
      : `\n\nWe'll email you your lease agreement to sign shortly. Once it's signed, your resident portal is unlocked.`;
    const invoiceLine = invoiceUrl
      ? `\n\nYour move-in invoice (first month's rent${listing.adminFee ? ', admin fee' : ''}${listing.deposit ? ' and deposit' : ''}) is ready to view here:\n${invoiceUrl}`
      : '';

    const body =
      `${greeting} We're delighted to let you know your rental application has been approved, ` +
      `and your lease begins on ${startDate}.` +
      signLine +
      invoiceLine +
      (agency ? `\n\n— The ${agency} team` : '');

    const subject = agency ? `Welcome home — you're approved at ${agency} 🎉` : 'Welcome home — your application is approved 🎉';

    // Rich HTML for email: friendly buttons instead of raw URLs.
    let html: string | undefined;
    if (isEmail) {
      const buttons = [] as { label: string; url: string }[];
      if (signUrl) buttons.push({ label: 'Review & sign your lease', url: signUrl });
      if (invoiceUrl) buttons.push({ label: 'View your move-in invoice', url: invoiceUrl });
      html = renderEmail({
        ...brand,
        agencyName: agency || undefined,
        heading: greeting,
        paragraphs: [
          `Great news — your rental application has been approved, and your lease begins on ${startDate}.`,
          signUrl
            ? 'Your next step is to review and sign your lease agreement. Once it\'s signed, your resident portal is unlocked and you can pay rent, log maintenance and message our team.'
            : "We'll email you your lease agreement to sign shortly. Once it's signed, your resident portal is unlocked.",
          ...(invoiceUrl ? [`Your move-in invoice (first month's rent${listing.adminFee ? ', admin fee' : ''}${listing.deposit ? ' and deposit' : ''}) is ready to view below.`] : []),
        ],
        buttons,
        footerNote: "We're excited to have you with us. Welcome aboard!",
      });
    }

    const res = await provider.send({ to, subject, body, html });
    if (!res.ok) this.logger.error(`Approval notify to ${to} failed: ${res.error ?? 'unknown'}`);
  }

  private async load(applicationId: string): Promise<{ app: Application; listing: Listing }> {
    const app = await this.tenant.getRepository(Application).findOne({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('Application not found');
    const listing = await this.tenant.getRepository(Listing).findOne({ where: { id: app.listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return { app, listing };
  }

  private assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Cannot move application from ${from} to ${to}`);
    }
  }
}
