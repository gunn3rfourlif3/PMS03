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

    const tenantUserId = await this.identity.ensureTenantUser(
      app.applicantEmail, app.applicantName, app.applicantPhone,
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

    // (b) Raise the first rent invoice for the lease's start month. Tolerant of
    // failure so a billing hiccup never blocks the approval itself.
    try {
      const period = startDate.slice(0, 7);               // 'YYYY-MM'
      const pr = prorateFirstMonth(Number(listing.advertisedRent), startDate);
      await this.invoices.generateRentInvoice({
        leaseId: lease.id,
        tenantId: tenantUserId,
        period,
        dueDate: startDate,
        rentAmount: pr.amount,
        description: pr.prorated
          ? `Rent ${period} (pro-rata ${pr.days}/${pr.daysInMonth} days)`
          : `Rent ${period}`,
      });
    } catch (e: any) {
      this.logger.error(`First invoice for lease ${lease.id} failed: ${e.message} (run billing manually)`);
    }

    // (a) Tell the applicant they're approved and how to sign in.
    await this.notifyApproved(app, listing, startDate).catch((e) =>
      this.logger.error(`Approval notification failed: ${e.message}`),
    );

    // (c) Generate the lease agreement and email the applicant a signing link.
    await this.leaseAgreements.createForLease({
      leaseId: lease.id,
      tenantId: tenantUserId,
      unitId: listing.unitId,
      tenantName: app.applicantName,
      tenantEmail: app.applicantEmail,
      tenantIdNumber: (app.details as any)?.idNumber,
      rentAmount: Number(listing.advertisedRent),
      startDate,
    }).catch((e) => this.logger.error(`Lease agreement generation failed: ${e.message}`));

    return saved;
  }

  /** Email/SMS the applicant that they're approved, with sign-in instructions. */
  private async notifyApproved(app: Application, listing: Listing, startDate: string): Promise<void> {
    if (!this.channels) return;
    const isEmail = !!app.applicantEmail;
    const to = app.applicantEmail || app.applicantPhone;
    if (!to) return;
    const provider = this.channels.get(isEmail ? 'email' : 'sms');
    if (!provider) return;

    const url = process.env.TENANT_APP_URL?.trim();
    const where = url ? ` at ${url}` : '';
    const signInWith = app.applicantEmail || app.applicantPhone;
    const firstName = app.applicantName?.trim().split(/\s+/)[0];
    const greeting = firstName ? `Welcome home, ${firstName}!` : 'Welcome home!';

    // Sign off with the agency's name (vendor is RLS-scoped to the caller here).
    const rows = await this.tenant.getManager().query('SELECT name FROM vendors WHERE id = $1', [this.tenant.vendorId]);
    const agency = (rows?.[0]?.name ?? '').trim();

    const body =
      `${greeting} We're delighted to let you know your rental application has been approved, ` +
      `and your lease begins on ${startDate}. ` +
      `To get started, simply sign in${where} with ${signInWith} — from there you can view your lease, ` +
      `pay your rent, log any maintenance and message our team whenever you need us. ` +
      `We're excited to have you with us. Welcome aboard!` +
      (agency ? `\n\n— The ${agency} team` : '');

    const subject = agency ? `Welcome home — you're approved at ${agency} 🎉` : 'Welcome home — your application is approved 🎉';
    const res = await provider.send({ to, subject, body });
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
