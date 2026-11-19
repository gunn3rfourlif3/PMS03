import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import BrandProvider from '@/components/brand-provider';
import Shell from '@/components/shell';
import { brandForHost, brandKeyFromHost, isPlatformHostFor } from '@/lib/brand-shared';
import DeploymentProvider from '@/components/deployment-provider';
import { resolveDeploymentProfile } from '@/lib/deployment';
import LocaleProvider from '@/components/locale-provider';
import { resolveRequestLocale } from '@/lib/locale';
import { resolveTheme } from '@/lib/theme';
import { enabledLocales } from '@shared/i18n';

// Title/description must carry the brand name: this is what crawlers (and
// Google's OAuth brand-verification reviewer) see on app.<domain>. A generic
// "Back-office" title reads as a different app to the one on the consent screen.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';

/**
 * The agency's own name for <title>. brandForHost only knows "Locare" or the
 * generic default, so on an agency host the server title said "Property
 * Manager" — and Next re-applies the server title on navigation, overwriting
 * the correct one applyTheme sets client-side. Same lookup and timeout as the
 * favicon route; a slow or failed lookup falls back rather than holding the page.
 */
async function agencyName(host: string): Promise<string | null> {
  if (isPlatformHostFor(host)) return null;
  try {
    const res = await fetch(`${API_BASE}/branding/${encodeURIComponent(brandKeyFromHost(host))}`, {
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const b = await res.json();
    return typeof b?.name === 'string' && b.name.trim() ? b.name.trim() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host') ?? '';
  const base = brandForHost(host);
  const name = (await agencyName(host)) ?? base.name;
  const brand = { ...base, name };
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
  // Which locales this deployment may serve at all, as opposed to which
  // catalogues are in the build. DEPLOYMENT_LOCALE unset -- every production
  // container -- means English alone: the switcher hides and a stored
  // non-English preference is ignored.
  const locales = enabledLocales(process.env.DEPLOYMENT_LOCALE);
  // Light unless a deployment opts in, so production is untouched. Resolved
  // here rather than in the browser because a class applied on mount gives
  // every load a white flash before the dark paint lands.
  const theme = resolveTheme(process.env.DEPLOYMENT_THEME);
  // Comma-separated hrefs to leave out of the menu. Unset everywhere but the
  // on-site demo, so production menus are untouched.
  const hiddenNav = (process.env.DEPLOYMENT_HIDE_NAV ?? '')
    .split(',').map((h) => h.trim()).filter((h) => h.startsWith('/'));

  return (
    // `lang` is the server's best guess; LocaleProvider corrects it on mount if
    // the viewer has a stored preference. `suppressHydrationWarning` covers
    // exactly that one attribute — without it React warns on every load where a
    // stored locale differs from the deployment's.
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <body>
        <BrandProvider initial={brand}>
          <LocaleProvider initial={locale} locales={locales}>
            <DeploymentProvider profile={deployment} hiddenNav={hiddenNav}>
              <Shell>{children}</Shell>
            </DeploymentProvider>
          </LocaleProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
