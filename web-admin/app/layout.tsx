import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import BrandProvider from '@/components/brand-provider';
import Shell from '@/components/shell';
import { brandForHost } from '@/lib/brand-shared';

// Title/description must carry the brand name: this is what crawlers (and
// Google's OAuth brand-verification reviewer) see on app.<domain>. A generic
// "Back-office" title reads as a different app to the one on the consent screen.
export function generateMetadata(): Metadata {
  const brand = brandForHost(headers().get('host') ?? '');
  const description =
    brand.slug === 'locare'
      ? 'Locare is a white-label property-management platform for South African rental agencies — leasing, rent collection, trust accounting, and branded tenant & landlord apps. Sign in to your agency back-office.'
      : `${brand.name} back-office — leasing, rent collection, trust accounting and owner payouts.`;
  return {
    title: `${brand.name} — Back-office`,
    description,
    applicationName: brand.name,
    // Resolved per-host by app/api/icon — a static icon here would show
    // Locare's mark in every agency's browser tab.
    icons: { icon: [{ url: '/api/icon', type: 'image/svg+xml' }], apple: '/api/icon' },
    openGraph: {
      siteName: brand.name,
      title: `${brand.name} — Back-office`,
      description,
    },
  };
}

// The brand depends on the request's Host header, so this layout can't be
// statically prerendered — otherwise Next bakes one host's brand ("Property
// Manager") into the HTML served to every host, including Locare.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get('host') ?? '';
  const brand = brandForHost(host);

  return (
    <html lang="en">
      <body>
        <BrandProvider initial={brand}>
          <Shell>{children}</Shell>
        </BrandProvider>
      </body>
    </html>
  );
}
