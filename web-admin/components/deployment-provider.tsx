'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  DeploymentProfile, DeploymentCapabilities, capabilitiesFor, DEFAULT_DEPLOYMENT_PROFILE,
  fetchDeployment,
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
  const [value, setValue] = useState<DeploymentContextValue>({
    profile, capabilities: capabilitiesFor(profile),
  });

  // The server-rendered `profile` is a first paint that avoids a flash of the
  // wrong menu. The API is what ENFORCES the mode, so it is the authority:
  // confirm against it, and if they disagree the API wins. A failed fetch keeps
  // the server value — blanking the menu because one request failed is worse
  // than a stale label.
  useEffect(() => {
    let alive = true;
    fetchDeployment().then((d) => { if (alive && d) setValue(d); });
    return () => { alive = false; };
  }, []);

  return (
    <DeploymentContext.Provider value={value}>
      {children}
    </DeploymentContext.Provider>
  );
}
