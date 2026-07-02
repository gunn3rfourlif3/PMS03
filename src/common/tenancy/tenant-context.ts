/**
 * Holds the resolved tenant (vendor) for the current request.
 * Populated by TenantMiddleware from the auth claim / host, then used by:
 *   1. RLS: SET app.current_vendor_id  (DB-enforced isolation)
 *   2. App-layer scope: defence-in-depth so a missing RLS policy cannot leak.
 */
export interface TenantContext {
  vendorId: string | null; // null only for platform-admin / public routes
  userId: string | null;
  roles: string[];
}
