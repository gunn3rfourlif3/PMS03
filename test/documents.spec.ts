import { buildStorageKey, isExpired, canAccess } from '../src/modules/documents/storage-key';

describe('document storage-key + access', () => {
  it('builds a namespaced, sanitized key', () => {
    const key = buildStorageKey('v1', 'lease', 'l1', 'lease_agreement', 2, 'My Lease (final).pdf');
    expect(key).toBe('v1/lease/l1/lease_agreement/v2-My_Lease_final_.pdf');
  });

  it('detects expiry', () => {
    expect(isExpired('2000-01-01')).toBe(true);
    expect(isExpired('2999-01-01')).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });

  it('open scope allows any authenticated user', () => {
    expect(canAccess({ roles: [] }, ['tenant'])).toBe(true);
    expect(canAccess(undefined, ['tenant'])).toBe(true);
  });

  it('scoped docs require a matching role', () => {
    expect(canAccess({ roles: ['property_manager'] }, ['tenant'])).toBe(false);
    expect(canAccess({ roles: ['property_manager'] }, ['property_manager'])).toBe(true);
  });

  it('vendor_owner and platform_admin always pass', () => {
    expect(canAccess({ roles: ['property_manager'] }, ['vendor_owner'])).toBe(true);
    expect(canAccess({ roles: ['property_manager'] }, ['platform_admin'])).toBe(true);
  });
});
