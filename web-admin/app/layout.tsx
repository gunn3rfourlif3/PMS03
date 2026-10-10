import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import BrandProvider from '@/components/brand-provider';
import Shell from '@/components/shell';
import { brandForHost } from '@/lib/brand-shared';
import DeploymentProvider from '@/components/deployment-provider';
import { resolveDeploymentProfile } from '@/lib/deployment';
import LocaleProvider from '@/components/locale-provider';
import { resolveRequestLocale } from '@/lib/locale';

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
  // Server-side and at request time, not baked at build: one image serves all
  // three deployment modes, which is what makes the demo's mode switch work.
  const deployment = resolveDeploymentProfile(process.env.DEPLOYMENT_PROFILE);
  // Resolved per request like the brand above, so the first HTML is already in
  // the demo's language. DEPLOYMENT_LOCALE on the container is the whole switch.
  const locale = resolveRequestLocale(host, process.env.DEPLOYMENT_LOCALE);

  return (
    // `lang` is the server's best guess; LocaleProvider corrects it on mount if
    // the viewer has a stored preference. `suppressHydrationWarning` covers
    // exactly that one attribute — without it React warns on every load where a
    // stored locale differs from the deployment's.
    <html lang={locale} suppressHydrationWarning>
      <body>
        <BrandProvider initial={brand}>
          <LocaleProvider initial={locale}>
            <DeploymentProvider profile={deployment}>
              <Shell>{children}</Shell>
            </DeploymentProvider>
          </LocaleProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
