import { Injectable } from '@nestjs/common';

/**
 * Maintenance domain service.
 * Owns its own tables only; never reaches into another module's tables
 * directly (modular-monolith boundary). Expose behaviour via this service.
 */
@Injectable()
export class MaintenanceService {
  ping(): string {
    return 'Maintenance module ready';
  }
}
