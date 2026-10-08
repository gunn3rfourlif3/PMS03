import { signatureUrlFor } from '../src/modules/lease-agreement/lease-agreement.service';

const BASE = 'https://app.example.test';

describe('where a new lease agreement is signed', () => {
  it('points at the tenant signing page when e-signature is served', () => {
    expect(signatureUrlFor(BASE, 'las_abc', true)).toBe(`${BASE}/sign/las_abc`);
  });

  // Mode A. A tenant signing link on a sealed install points at a server the
  // tenant cannot reach; a link that looks right and silently cannot work is
  // worse than no link at all.
  it('points at the internal print route when it is not', () => {
    expect(signatureUrlFor(BASE, 'las_abc', false)).toBe(`${BASE}/leases/print/las_abc`);
  });

  it('never leaves a tenant-facing /sign/ URL in the sealed mode', () => {
    expect(signatureUrlFor(BASE, 'las_abc', false)).not.toContain('/sign/');
  });

  it('tolerates a trailing slash on the base', () => {
    expect(signatureUrlFor(`${BASE}///`, 'las_abc', false)).toBe(`${BASE}/leases/print/las_abc`);
  });

  it('survives an unset base', () => {
    expect(signatureUrlFor('', 'las_abc', false)).toBe('/leases/print/las_abc');
    expect(signatureUrlFor(undefined as unknown as string, 'las_abc', true)).toBe('/sign/las_abc');
  });
});
