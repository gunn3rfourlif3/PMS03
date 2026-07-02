/**
 * Pure storage-key + document helpers (no DB/framework), so path building,
 * expiry, and access checks are unit-testable.
 */

/** Deterministic, collision-resistant key: vendor/owner/type/version-filename. */
export function buildStorageKey(
  vendorId: string,
  ownerType: string,
  ownerId: string,
  type: string,
  version: number,
  filename: string,
): string {
  const safe = filename.replace(/[^\w.\-]+/g, '_');
  return `${vendorId}/${ownerType}/${ownerId}/${type}/v${version}-${safe}`;
}

export function isExpired(expiryDate?: string, now: Date = new Date()): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() < now.getTime();
}

/**
 * Access check: an empty scope means any authenticated vendor user; otherwise
 * the principal must hold at least one of the scoped roles. platform_admin and
 * vendor_owner always pass.
 */
export function canAccess(
  scope: { roles?: string[] } | undefined,
  principalRoles: string[],
): boolean {
  if (principalRoles.includes('platform_admin') || principalRoles.includes('vendor_owner')) {
    return true;
  }
  const required = scope?.roles ?? [];
  if (required.length === 0) return true;
  return required.some((r) => principalRoles.includes(r));
}
