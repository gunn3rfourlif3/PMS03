/**
 * The deployment mode, client side.
 *
 * A STRUCTURAL COPY of `src/common/config/deployment-profile.ts`. Importing the
 * real one would pull the API's module graph into the browser bundle, the same
 * reason `components/assistant/signals.ts` copies the funnel stages. The two
 * move together; if a capability is added there, add it here.
 *
 * THE API IS THE ENFORCER. Everything here is presentation: it decides what to
 * show, never what is allowed. A mode A installation refuses tenant sign-in and
 * public listings server-side whatever this file says.
 */

export type DeploymentProfile = 'onsite_backoffice' | 'onsite_connected' | 'private_server';

export interface DeploymentCapabilities {
  tenantLogins: boolean;
  landlordLogins: boolean;
  publicListings: boolean;
  onlineRent: boolean;
  eSignature: boolean;
  otpToPhone: boolean;
}

const SEALED: DeploymentCapabilities = {
  tenantLogins: false, landlordLogins: false, publicListings: false,
  onlineRent: false, eSignature: false, otpToPhone: false,
};
const CONNECTED: DeploymentCapabilities = {
  tenantLogins: true, landlordLogins: true, publicListings: true,
  onlineRent: true, eSignature: true, otpToPhone: true,
};

export const CAPABILITIES: Record<DeploymentProfile, DeploymentCapabilities> = {
  onsite_backoffice: SEALED,
  onsite_connected: CONNECTED,
  private_server: CONNECTED,
};

export const DEPLOYMENT_LABELS: Record<DeploymentProfile, string> = {
  onsite_backoffice: 'On-site, back office',
  onsite_connected: 'On-site, connected',
  private_server: 'Private server',
};

export const DEFAULT_DEPLOYMENT_PROFILE: DeploymentProfile = 'private_server';

/**
 * Unlike the server's resolver, this one does NOT throw on an unknown value: a
 * bad env var must not blank the back office for staff who are working. The
 * server already refuses to boot on it, so an invalid value cannot reach here in
 * a running system — and if it somehow does, showing the full menu is the safe
 * failure, because the API still refuses what the mode forbids.
 */
export function resolveDeploymentProfile(value?: string | null): DeploymentProfile {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw in CAPABILITIES) return raw as DeploymentProfile;
  return DEFAULT_DEPLOYMENT_PROFILE;
}

export function capabilitiesFor(profile: DeploymentProfile): DeploymentCapabilities {
  return CAPABILITIES[profile];
}

/** A and B put the machine in the client's building. C is ours. */
export function isOnSite(profile: DeploymentProfile): boolean {
  return profile === 'onsite_backoffice' || profile === 'onsite_connected';
}

/**
 * Ask the API what mode this installation is in.
 *
 * The API enforces the mode, so it is the only honest source for it. The
 * server-rendered value in the root layout is a first paint that avoids a flash
 * of the wrong menu; this confirms it. If they ever disagree, this wins — and
 * the one that would have been wrong is the one that only decides what to show.
 *
 * On failure the caller keeps the server-rendered value: a back office that
 * blanks its own menu because one fetch failed is worse than a stale label.
 */
export async function fetchDeployment(): Promise<
  { profile: DeploymentProfile; capabilities: DeploymentCapabilities } | null
> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
    const res = await fetch(`${base}/deployment`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    const profile = resolveDeploymentProfile(body?.profile);
    return { profile, capabilities: body?.capabilities ?? capabilitiesFor(profile) };
  } catch {
    return null;
  }
}

