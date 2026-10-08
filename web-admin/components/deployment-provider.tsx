'use client';
import { createContext, useContext } from 'react';
import {
  DeploymentProfile, DeploymentCapabilities, capabilitiesFor, DEFAULT_DEPLOYMENT_PROFILE,
} from '@/lib/deployment';

interface DeploymentContextValue {
  profile: DeploymentProfile;
  capabilities: DeploymentCapabilities;
}

const DeploymentContext = createContext<DeploymentContextValue>({
  profile: DEFAULT_DEPLOYMENT_PROFILE,
  capabilities: capabilitiesFor(DEFAULT_DEPLOYMENT_PROFILE),
});

export const useDeployment = () => useContext(DeploymentContext);

/**
 * `profile` is read on the server in the root layout, which is already
 * `force-dynamic` for Host-based branding — so this is a runtime read, not a
 * value baked into the image at build time. One image therefore serves all three
 * modes, which is what makes the demo's mode switch possible at all.
 */
export default function DeploymentProvider({
  profile, children,
}: { profile: DeploymentProfile; children: React.ReactNode }) {
  return (
    <DeploymentContext.Provider value={{ profile, capabilities: capabilitiesFor(profile) }}>
      {children}
    </DeploymentContext.Provider>
  );
}
