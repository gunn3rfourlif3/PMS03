import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Listing } from './listing.entity';

export interface CreateListingInput {
  unitId: string;
  advertisedRent: number;
  availableFrom: string;
  description?: string;
}

@Injectable()
export class ListingsService {
  constructor(private readonly tenant: TenantContextService) {}

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

  /** Public browse: only published vacancies. */
  listPublished(): Promise<Listing[]> {
    return this.tenant.getRepository(Listing).find({ where: { status: 'published' } });
  }

  /** Manager: all listings for the vendor (incl. drafts/filled). */
  listAll(): Promise<Listing[]> {
    return this.tenant.getRepository(Listing).find({ order: { createdAt: 'DESC' } });
  }
}
