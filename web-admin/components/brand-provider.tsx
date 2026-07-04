'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { Branding, DEFAULT_BRANDING, VENDOR_SLUG, fetchBranding, applyTheme } from '@/lib/branding';

const BrandContext = createContext<Branding>(DEFAULT_BRANDING);
export const useBrand = () => useContext(BrandContext);

export default function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Branding>(DEFAULT_BRANDING);

  useEffect(() => {
    let alive = true;
    fetchBranding(VENDOR_SLUG)
      .then((b) => { if (alive) { applyTheme(b); setBrand(b); } })
      .catch(() => applyTheme(DEFAULT_BRANDING));
    return () => { alive = false; };
  }, []);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
