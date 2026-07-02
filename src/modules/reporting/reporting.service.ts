import { Injectable } from '@nestjs/common';

/**
 * Reporting domain service.
 * Owns its own tables only; never reaches into another module's tables
 * directly (modular-monolith boundary). Expose behaviour via this service.
 */
@Injectable()
export class ReportingService {
  ping(): string {
    return 'Reporting module ready';
  }
}
