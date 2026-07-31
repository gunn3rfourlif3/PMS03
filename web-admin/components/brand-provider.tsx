'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { Branding, DEFAULT_BRANDING, LOCARE_BRAND, brandKey, fetchBranding, applyTheme, isPlatformHost } from '@/lib/branding';

const BrandContext = createContext<Branding>(DEFAULT_BRANDING);
export const useBrand = () => useContext(BrandContext);

export default function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Branding>(DEFAULT_BRANDING);

  useEffect(() => {
    let alive = true;
    // Platform hosts (locare.co.za, app.locare.co.za, …) are Locare itself, not
    // an agency — brand them directly, no vendor lookup.
    if (isPlatformHost()) { applyTheme(LOCARE_BRAND); setBrand(LOCARE_BRAND); return; }
    fetchBranding(brandKey())
      .then((b) => { if (alive) { applyTheme(b); setBrand(b); } })
      .catch(() => applyTheme(DEFAULT_BRANDING));
    return () => { alive = false; };
  }, []);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
