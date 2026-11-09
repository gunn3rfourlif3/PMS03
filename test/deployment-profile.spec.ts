import {
  resolveDeploymentProfile,
  capabilitiesFor,
  deploymentProfile,
  deploymentCapabilities,
  isOnSite,
  DEPLOYMENT_PROFILES,
  DEFAULT_DEPLOYMENT_PROFILE,
  InvalidDeploymentProfileError,
  DeploymentProfile,
} from '../src/common/config/deployment-profile';

describe('resolving the profile', () => {
  it('defaults to the private server, so every deployment today is unchanged', () => {
    expect(resolveDeploymentProfile(undefined)).toBe('private_server');
    expect(resolveDeploymentProfile('')).toBe('private_server');
    expect(resolveDeploymentProfile('   ')).toBe('private_server');
    expect(DEFAULT_DEPLOYMENT_PROFILE).toBe('private_server');
  });

  it('accepts each of the three modes, case and whitespace insensitively', () => {
    expect(resolveDeploymentProfile('onsite_backoffice')).toBe('onsite_backoffice');
    expect(resolveDeploymentProfile(' ONSITE_CONNECTED ')).toBe('onsite_connected');
    expect(resolveDeploymentProfile('Private_Server')).toBe('private_server');
  });

  // The important one. Falling back on a typo would open tenant logins,
  // landlord logins and public listings on an installation configured to seal
  // them — failing open on the one setting whose purpose is to close things.
  it('throws on an unknown value rather than falling back to the open mode', () => {
    expect(() => resolveDeploymentProfile('onsite_backofice')).toThrow(InvalidDeploymentProfileError);
    expect(() => resolveDeploymentProfile('sealed')).toThrow(/not one of/);
  });
});

describe('capabilities', () => {
  it('serves nothing to the outside in the sealed back office', () => {
    const c = capabilitiesFor('onsite_backoffice');
    expect(c.tenantLogins).toBe(false);
    expect(c.landlordLogins).toBe(false);
    expect(c.publicListings).toBe(false);
    expect(c.onlineRent).toBe(false);
    expect(c.eSignature).toBe(false);
    expect(c.otpToPhone).toBe(false);
    // The one that runs the other way: with no gateway, cash and EFT are the
    // rails, so staff must be able to record that money arrived.
    expect(c.manualPayments).toBe(true);
  });

  const OUTWARD_FACING = [
    'tenantLogins', 'landlordLogins', 'publicListings',
    'onlineRent', 'eSignature', 'otpToPhone',
  ] as const;

  it('serves everything outward-facing in the connected on-site mode', () => {
    const c = capabilitiesFor('onsite_connected');
    for (const k of OUTWARD_FACING) expect(c[k]).toBe(true);
  });

  it('serves everything outward-facing on the private server', () => {
    const c = capabilitiesFor('private_server');
    for (const k of OUTWARD_FACING) expect(c[k]).toBe(true);
  });

  // A hand-confirm where a gateway is collecting is a way to mark an invoice
  // paid for money that never arrived, so the connected modes do not serve it.
  it('records payments by hand only in the sealed mode', () => {
    expect(capabilitiesFor('onsite_backoffice').manualPayments).toBe(true);
    expect(capabilitiesFor('onsite_connected').manualPayments).toBe(false);
    expect(capabilitiesFor('private_server').manualPayments).toBe(false);
  });

  // B and C differ in where the data sits and who runs the machine, not in what
  // the product does. The equality is the point, not an oversight.
  it('gives the two connected modes identical capabilities', () => {
    expect(capabilitiesFor('onsite_connected')).toEqual(capabilitiesFor('private_server'));
  });

  it('has an answer for every mode', () => {
    for (const p of DEPLOYMENT_PROFILES) {
      expect(capabilitiesFor(p as DeploymentProfile)).toBeDefined();
    }
  });
});

describe('on-site', () => {
  // A and B put the machine in the client's building, so the server, mail path,
  // backups and named IT person are theirs to supply.
  it('is true for both on-site modes and false for the private server', () => {
    expect(isOnSite('onsite_backoffice')).toBe(true);
    expect(isOnSite('onsite_connected')).toBe(true);
    expect(isOnSite('private_server')).toBe(false);
  });
});

describe('reading the environment', () => {
  const original = process.env.DEPLOYMENT_PROFILE;
  afterEach(() => {
    if (original === undefined) delete process.env.DEPLOYMENT_PROFILE;
    else process.env.DEPLOYMENT_PROFILE = original;
  });

  it('reads the live mode and its capabilities from DEPLOYMENT_PROFILE', () => {
    process.env.DEPLOYMENT_PROFILE = 'onsite_backoffice';
    expect(deploymentProfile()).toBe('onsite_backoffice');
    expect(deploymentCapabilities().tenantLogins).toBe(false);
  });

  it('falls back to the private server when the variable is absent', () => {
    delete process.env.DEPLOYMENT_PROFILE;
    expect(deploymentProfile()).toBe('private_server');
    expect(deploymentCapabilities().tenantLogins).toBe(true);
  });
});
