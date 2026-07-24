import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { LeasingService } from '@modules/leasing/leasing.service';
import { PropertiesService } from '@modules/properties/properties.service';
import { IdentityService } from '@modules/identity/identity.service';
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
    return saved;
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
