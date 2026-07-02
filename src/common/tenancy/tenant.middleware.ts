import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Resolves the vendor for each request.
 *
 * Resolution order:
 *   1. Authenticated JWT claim `vendor_id` (primary).
 *   2. Custom domain / Host header -> vendor lookup (white-label entry).
 *
 * The resolved vendorId is attached to the request and later pushed into the
 * DB session (SET app.current_vendor_id) so Postgres RLS policies apply.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // TODO: replace with real JWT verification + host->vendor cache (Redis).
    const claimVendor = (req.headers['x-vendor-id'] as string) ?? null;
    (req as any).tenant = {
      vendorId: claimVendor,
      userId: (req.headers['x-user-id'] as string) ?? null,
      roles: ((req.headers['x-roles'] as string) ?? '')
        .split(',')
        .filter(Boolean),
    };
    next();
  }
}
