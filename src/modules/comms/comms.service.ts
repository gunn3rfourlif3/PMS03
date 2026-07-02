import { Injectable } from '@nestjs/common';

/**
 * Comms domain service.
 * Owns its own tables only; never reaches into another module's tables
 * directly (modular-monolith boundary). Expose behaviour via this service.
 */
@Injectable()
export class CommsService {
  ping(): string {
    return 'Comms module ready';
  }
}
