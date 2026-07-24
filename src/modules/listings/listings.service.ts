import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Listing, ListingStatus } from './listing.entity';

export interface CreateListingInput {
  unitId: string;
  advertisedRent: number;
  availableFrom: string;
  description?: string;
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly tenant: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * PUBLIC (no auth/tenant context): published listings for a vendor resolved by
   * slug or custom domain, via a SECURITY DEFINER function that bypasses RLS.
   */
  async publicList(vendorKey: string): Promise<unknown[]> {
    const rows = await this.dataSource.query('SELECT public_listings($1) AS d', [vendorKey]);
    const d = rows[0]?.d;
    return (typeof d === 'string' ? JSON.parse(d) : d) ?? [];
  }

  /** PUBLIC: a single published listing with unit/property detail. */
  async publicOne(id: string): Promise<unknown> {
    const rows = await this.dataSource.query('SELECT public_listing($1) AS d', [id]);
    const d = rows[0]?.d;
    const parsed = typeof d === 'string' ? JSON.parse(d) : d;
    if (!parsed) throw new NotFoundException('Listing not found or no longer available');
    return parsed;
  }

  create(input: CreateListingInput): Promise<Listing> {
    const repo = this.tenant.getRepository(Listing);
    return repo.save(
      repo.create({ ...input, vendorId: this.tenant.vendorId ?? undefined, status: 'draft' }),
    );
  }

  async setStatus(listingId: string, status: Listing['status']): Promise<Listing> {
    const repo = this.tenant.getRepository(Listing);
    const listing = await repo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    listing.status = status;
    return repo.save(listing);
  }

  /** Manager status changes from the back-office (publish/pause/close/draft). */
  changeStatus(listingId: string, status: ListingStatus): Promise<Listing> {
    const allowed: ListingStatus[] = ['draft', 'published', 'paused', 'closed'];
    if (!allowed.includes(status)) throw new BadRequestException('Invalid listing status');
    return this.setStatus(listingId, status);
  }

  /** Public browse: only published vacancies. */
  listPublished(): Promise<Listing[]> {
    return this.tenant.getRepository(Listing).find({ where: { status: 'published' } });
  }

  /** Manager: all listings for the vendor (incl. drafts/filled). */
  listAll(): Promise<Listing[]> {
    return this.tenant.getRepository(Listing).find({ order: { createdAt: 'DESC' } });
  }
}
