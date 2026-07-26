import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { MediaService, UploadedFileLike } from '@modules/media/media.service';
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
    private readonly media: MediaService,
  ) {}

  /** Upload a photo and append its public URL to the listing's media gallery. */
  async addPhoto(listingId: string, file: UploadedFileLike): Promise<string[]> {
    const repo = this.tenant.getRepository(Listing);
    const listing = await repo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    const { url } = await this.media.save(file);
    listing.media = [...((listing.media as string[]) ?? []), url];
    await repo.save(listing);
    return listing.media as string[];
  }

  async removePhoto(listingId: string, url: string): Promise<string[]> {
    const repo = this.tenant.getRepository(Listing);
    const listing = await repo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    listing.media = ((listing.media as string[]) ?? []).filter((m) => m !== url);
    await repo.save(listing);
    return listing.media as string[];
  }

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

  private static readonly OPEN: ListingStatus[] = ['draft', 'published', 'paused'];

  async create(input: CreateListingInput): Promise<Listing> {
    const repo = this.tenant.getRepository(Listing);
    const existing = await repo.findOne({ where: { unitId: input.unitId, status: In(ListingsService.OPEN) } });
    if (existing) {
      throw new ConflictException('This unit already has an active listing. Close the existing one before creating another.');
    }
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
  async changeStatus(listingId: string, status: ListingStatus): Promise<Listing> {
    const allowed: ListingStatus[] = ['draft', 'published', 'paused', 'closed'];
    if (!allowed.includes(status)) throw new BadRequestException('Invalid listing status');

    // Re-opening a listing must not collide with another open listing on the unit.
    if (ListingsService.OPEN.includes(status)) {
      const repo = this.tenant.getRepository(Listing);
      const listing = await repo.findOne({ where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (!ListingsService.OPEN.includes(listing.status)) {
        const other = await repo.findOne({
          where: { unitId: listing.unitId, id: Not(listingId), status: In(ListingsService.OPEN) },
        });
        if (other) throw new ConflictException('Another active listing already exists for this unit.');
      }
    }
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
