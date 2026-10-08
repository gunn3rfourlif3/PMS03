import { ForbiddenException } from '@nestjs/common';
import {
  isRoleServed, rolesRefused, capabilitiesFor, deploymentRefusalMessage,
} from '../src/common/config/deployment-profile';
import { CapabilityGuard, CAPABILITY_KEY } from '../src/common/config/capability.guard';

const SEALED = capabilitiesFor('onsite_backoffice');
const CONNECTED = capabilitiesFor('onsite_connected');
const PRIVATE = capabilitiesFor('private_server');

describe('which roles a mode serves', () => {
  it('refuses tenants and landlords in the sealed back office', () => {
    expect(isRoleServed('tenant', SEALED)).toBe(false);
    expect(isRoleServed('owner', SEALED)).toBe(false);
  });

  // The whole premise of option A: their own people at their own desks work.
  it('serves staff in every mode', () => {
    for (const caps of [SEALED, CONNECTED, PRIVATE]) {
      expect(isRoleServed('vendor_owner', caps)).toBe(true);
      expect(isRoleServed('property_manager', caps)).toBe(true);
    }
  });

  it('serves tenants and landlords in both connected modes', () => {
    for (const caps of [CONNECTED, PRIVATE]) {
      expect(isRoleServed('tenant', caps)).toBe(true);
      expect(isRoleServed('owner', caps)).toBe(true);
    }
  });

  // Locare's own roles, not the agency's outsiders. Guessing a rule for them
  // would be inventing policy the client note does not contain.
  it('does not gate Locare-side roles', () => {
    expect(isRoleServed('partner', SEALED)).toBe(true);
    expect(isRoleServed('platform_admin', SEALED)).toBe(true);
  });

  it('names exactly the refused roles on a token', () => {
    expect(rolesRefused(['tenant'], SEALED)).toEqual(['tenant']);
    expect(rolesRefused(['property_manager'], SEALED)).toEqual([]);
    expect(rolesRefused(['tenant'], PRIVATE)).toEqual([]);
    expect(rolesRefused([], SEALED)).toEqual([]);
  });

  it('tells a refused person why, without pretending the account is missing', () => {
    const m = deploymentRefusalMessage('onsite_backoffice');
    expect(m).toContain('staff use only');
    expect(m).not.toMatch(/not found|no such account/i);
  });
});

describe('the capability guard', () => {
  const ctx = (cap?: string) => ({
    getHandler: () => 'h',
    getClass: () => 'c',
  }) as any;
  const reflector = (cap?: string) => ({
    getAllAndOverride: (key: string) => (key === CAPABILITY_KEY ? cap : undefined),
  }) as any;

  const original = process.env.DEPLOYMENT_PROFILE;
  afterEach(() => {
    if (original === undefined) delete process.env.DEPLOYMENT_PROFILE;
    else process.env.DEPLOYMENT_PROFILE = original;
  });

  it('lets an unmarked endpoint through in every mode', () => {
    process.env.DEPLOYMENT_PROFILE = 'onsite_backoffice';
    expect(new CapabilityGuard(reflector(undefined)).canActivate(ctx())).toBe(true);
  });

  it('refuses a marked endpoint when the mode does not serve it', () => {
    process.env.DEPLOYMENT_PROFILE = 'onsite_backoffice';
    const guard = new CapabilityGuard(reflector('publicListings'));
    expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
  });

  // A 404 would be kinder to look at and worse to demo: the client's question
  // is whether it is actually off, and a 403 naming the mode answers it.
  it('refuses rather than hiding, and names the mode', () => {
    process.env.DEPLOYMENT_PROFILE = 'onsite_backoffice';
    const guard = new CapabilityGuard(reflector('publicListings'));
    try {
      guard.canActivate(ctx());
      throw new Error('expected a refusal');
    } catch (e: any) {
      const body = e.getResponse();
      expect(body.statusCode).toBe(403);
      expect(body.code).toBe('DEPLOYMENT_PROFILE_FORBIDS_CAPABILITY');
      expect(body.message).toContain('On-site, back office');
    }
  });

  it('serves the same endpoint in both connected modes', () => {
    for (const p of ['onsite_connected', 'private_server']) {
      process.env.DEPLOYMENT_PROFILE = p;
      expect(new CapabilityGuard(reflector('publicListings')).canActivate(ctx())).toBe(true);
    }
  });

  it('serves it when the variable is unset, so nothing changes for today', () => {
    delete process.env.DEPLOYMENT_PROFILE;
    expect(new CapabilityGuard(reflector('publicListings')).canActivate(ctx())).toBe(true);
  });
});
