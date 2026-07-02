import { Injectable } from '@nestjs/common';

/**
 * Billing domain service.
 * Owns its own tables only; never reaches into another module's tables
 * directly (modular-monolith boundary). Expose behaviour via this service.
 */
@Injectable()
export class BillingService {
  ping(): string {
    return 'Billing module ready';
  }
}
