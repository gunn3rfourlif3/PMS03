/**
 * Where this installation runs, and what that costs — see
 * docs/LOCARE_ONSITE_DEMO_BUILD_PLAN.md and LOCARE_ONSITE_CLIENT_OPTIONS.md.
 *
 * ONE flag decides a mode. There is deliberately no per-feature environment
 * variable: a second switch is how a deployment ends up half-sealed, with the
 * tenant portal off and the public listings still answering.
 *
 * The whole trade-off, from the client note: everything an agency's own staff do
 * at their desks works on an internal server. Anything an outsider must reach —
 * card and instant-EFT rent, e-signature, tenant and landlord logins, public
 * listings, login codes to phones — needs one address published to the internet.
 */

export type DeploymentProfile =
  /** A: their building, sealed off. Staff back office only. */
  | 'onsite_backoffice'
  /** B: their building, one published address. The full product on their hardware. */
  | 'onsite_connected'
  /** C: our data centre, their own database. The full product, run by us. */
  | 'private_server';

export const DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = [
  'onsite_backoffice',
  'onsite_connected',
  'private_server',
];

/**
 * What a mode serves. Every question the rest of the code is allowed to ask.
 *
 * B and C are identical here, and that is the honest answer rather than an
 * oversight: they differ in WHERE the data sits and WHO runs the machine, not in
 * what the product does. Inventing a feature difference to make the table look
 * less repetitive would be inventing a difference the client would not find.
 */
export interface DeploymentCapabilities {
  /** Tenants can sign in to the tenant app and portal. */
  tenantLogins: boolean;
  /** Landlords can sign in to the owner portal and app. */
  landlordLogins: boolean;
  /** Public rentals listings are served to the internet. */
  publicListings: boolean;
  /** Card and instant-EFT rent collection. Mode A recovers by statement import. */
  onlineRent: boolean;
  /** E-signature of leases. Mode A prints and signs. */
  eSignature: boolean;
  /** OTP codes can be delivered to a phone (SMS/WhatsApp) rather than internal mail. */
  otpToPhone: boolean;
}

const SEALED: DeploymentCapabilities = {
  tenantLogins: false,
  landlordLogins: false,
  publicListings: false,
  onlineRent: false,
  eSignature: false,
  otpToPhone: false,
};

const CONNECTED: DeploymentCapabilities = {
  tenantLogins: true,
  landlordLogins: true,
  publicListings: true,
  onlineRent: true,
  eSignature: true,
  otpToPhone: true,
};

const CAPABILITIES: Record<DeploymentProfile, DeploymentCapabilities> = {
  onsite_backoffice: SEALED,
  onsite_connected: CONNECTED,
  private_server: CONNECTED,
};

/** C, the mode every existing deployment is already in. */
export const DEFAULT_DEPLOYMENT_PROFILE: DeploymentProfile = 'private_server';

export class InvalidDeploymentProfileError extends Error {
  constructor(value: string) {
    super(
      `DEPLOYMENT_PROFILE "${value}" is not one of: ${DEPLOYMENT_PROFILES.join(', ')}`,
    );
    this.name = 'InvalidDeploymentProfileError';
  }
}

/**
 * Resolve the mode from a value (the environment, in production).
 *
 * UNSET falls back to `private_server`, so every deployment that exists today
 * behaves exactly as it does today.
 *
 * INVALID THROWS, and deliberately does not fall back. Defaulting a typo to
 * `private_server` would silently open tenant logins, landlord logins and public
 * listings on an installation someone had configured to be sealed — failing open
 * on the one setting whose whole purpose is to close things. A deployment with a
 * misspelled profile should refuse to boot and say so.
 */
export function resolveDeploymentProfile(value?: string | null): DeploymentProfile {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return DEFAULT_DEPLOYMENT_PROFILE;
  if ((DEPLOYMENT_PROFILES as readonly string[]).includes(raw)) {
    return raw as DeploymentProfile;
  }
  throw new InvalidDeploymentProfileError(value ?? '');
}

/** The live mode, from `DEPLOYMENT_PROFILE`. */
export function deploymentProfile(): DeploymentProfile {
  return resolveDeploymentProfile(process.env.DEPLOYMENT_PROFILE);
}

export function capabilitiesFor(profile: DeploymentProfile): DeploymentCapabilities {
  return CAPABILITIES[profile];
}

/** The live mode's capabilities. */
export function deploymentCapabilities(): DeploymentCapabilities {
  return capabilitiesFor(deploymentProfile());
}

/**
 * A and B: the machine is in the client's building, so the server, the mail
 * path, the backups and the named IT person are theirs to supply. C is ours.
 */
export function isOnSite(profile: DeploymentProfile): boolean {
  return profile === 'onsite_backoffice' || profile === 'onsite_connected';
}

/** Short, unbranded labels. The demo console and the back office both show these. */
export const DEPLOYMENT_LABELS: Record<DeploymentProfile, string> = {
  onsite_backoffice: 'On-site, back office',
  onsite_connected: 'On-site, connected',
  private_server: 'Private server',
};

/**
 * Whether a signed-in role is served at all in this mode.
 *
 * Only the two the client note names: tenants and landlords. Staff are served in
 * every mode — that is the whole premise of option A. `partner` and
 * `platform_admin` are Locare's own roles rather than the agency's outsiders, so
 * they are not gated here; on a sealed box nobody holds those accounts anyway,
 * and guessing at a rule for them would be inventing policy.
 */
export function isRoleServed(role: string, caps: DeploymentCapabilities): boolean {
  if (role === 'tenant') return caps.tenantLogins;
  if (role === 'owner') return caps.landlordLogins;
  return true;
}

/** True when none of the roles on a token may sign in under this mode. */
export function rolesRefused(roles: string[], caps: DeploymentCapabilities): string[] {
  return (roles ?? []).filter((r) => !isRoleServed(r, caps));
}

/**
 * What a refused person is told. Unbranded, states the reason plainly, and does
 * not pretend the account is missing — they are a real tenant, on an
 * installation that does not serve tenants.
 */
export function deploymentRefusalMessage(profile: DeploymentProfile): string {
  return `This system is installed on-site for staff use only (${DEPLOYMENT_LABELS[profile]}), so tenant and landlord sign-in is not available. Please contact the managing agent.`;
}

