'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, Tags, ClipboardList, ClipboardCheck, CalendarClock, Users, Wrench, BarChart3, FileText, KeyRound, Settings as SettingsIcon, LogOut, Menu, X, Bell, MessageSquare, LayoutGrid, Receipt, Landmark, FileUp, Handshake, Columns3, Activity, Trophy, CreditCard, Banknote, Rocket, Megaphone, FileSpreadsheet, ShieldCheck , Gauge } from 'lucide-react';
import { auth, api, actorFromToken } from '@/lib/api';
import { useBrand } from './brand-provider';
import IdleTimeout from './idle-timeout';
import AssistantPanel from './assistant/panel';
import { cn } from '@/lib/cn';
import { useDeployment } from './deployment-provider';
import { DeploymentCapabilities, isOnSite } from '@/lib/deployment';
import { useLocale, useT } from './locale-provider';
import LocaleSwitcher from './locale-switcher';
import type { MessageKey } from '@shared/i18n';

type NavItem = { href: string; key: MessageKey; icon: any; requires?: keyof DeploymentCapabilities };

/* Annotated rather than inferred: without it TypeScript widens `key` to
   `string` and the catalogue's key union stops catching a typo'd key. */
const NAV: readonly NavItem[] = [
  { href: '/', key: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/properties', key: 'nav.properties', icon: Building2 },
  { href: '/leases', key: 'nav.leases', icon: CalendarClock },
  { href: '/lease-parsing', key: 'nav.leaseParsing', icon: FileUp },
  { href: '/payments', key: 'nav.payments', icon: Receipt },
  { href: '/statements', key: 'nav.statements', icon: Banknote },
  { href: '/listings', key: 'nav.listings', icon: Tags, requires: 'publicListings' as const },
  { href: '/applications', key: 'nav.applications', icon: ClipboardList, requires: 'publicListings' as const },
  { href: '/owners', key: 'nav.owners', icon: Users },
  { href: '/agents', key: 'nav.agents', icon: Handshake },
  { href: '/providers', key: 'nav.providers', icon: Wrench },
  { href: '/reports', key: 'nav.reports', icon: BarChart3 },
  { href: '/documents', key: 'nav.documents', icon: FileText },
  { href: '/inspections', key: 'nav.inspections', icon: ClipboardCheck },
  { href: '/utilities', key: 'nav.utilities', icon: Gauge },
  { href: '/api-keys', key: 'nav.apiKeys', icon: KeyRound },
  { href: '/notifications', key: 'nav.notifications', icon: Bell },
  { href: '/messages', key: 'nav.messages', icon: MessageSquare },
  { href: '/billing', key: 'nav.billing', icon: CreditCard },
  { href: '/settings', key: 'nav.settings', icon: SettingsIcon },
];

const PORTAL_NAV: readonly NavItem[] = [
  { href: '/portal', key: 'portal.nav.overview', icon: LayoutGrid },
  { href: '/portal/statements', key: 'portal.nav.statements', icon: Receipt },
  { href: '/portal/properties', key: 'portal.nav.properties', icon: Building2 },
  { href: '/portal/banking', key: 'portal.nav.banking', icon: Landmark },
];

const PARTNER_NAV: readonly NavItem[] = [
  { href: '/partner', key: 'partner.nav.overview', icon: LayoutGrid },
  { href: '/partner/pipeline', key: 'partner.nav.pipeline', icon: Columns3 },
  { href: '/partner/activity', key: 'partner.nav.activity', icon: Activity },
  { href: '/partner/leaderboard', key: 'partner.nav.leaderboard', icon: Trophy },
  { href: '/partner/agencies', key: 'partner.nav.agencies', icon: Building2 },
  { href: '/partner/commissions', key: 'partner.nav.commissions', icon: Receipt },
  { href: '/partner/banking', key: 'partner.nav.banking', icon: Landmark },
];

const ADMIN_NAV: readonly NavItem[] = [
  // First, deliberately: bringing an agency live is the work in front of you.
  // Everything below it is administration of agencies already running.
  { href: '/admin/onboarding', key: 'admin.nav.onboarding', icon: Rocket },
  { href: '/admin/agencies', key: 'admin.nav.agencies', icon: Building2 },
  { href: '/admin/partners', key: 'admin.nav.partners', icon: Handshake },
  { href: '/admin/partner-applications', key: 'admin.nav.applications', icon: ClipboardCheck },
  { href: '/admin/commissions', key: 'admin.nav.commissions', icon: Receipt },
  { href: '/admin/payouts', key: 'admin.nav.payouts', icon: Banknote },
  { href: '/admin/billing', key: 'admin.nav.billing', icon: CreditCard },
  { href: '/admin/imports', key: 'admin.nav.imports', icon: FileSpreadsheet },
  { href: '/admin/changelog', key: 'admin.nav.changelog', icon: Megaphone },
  { href: '/admin/operators', key: 'admin.nav.operators', icon: ShieldCheck },
];

/** Shown whenever the session token carries an impersonation `act` claim. */
function ImpersonationBanner() {
  const [busy, setBusy] = useState(false);
  const t = useT();
  const b = useBrand();
  const actor = actorFromToken();
  if (!actor) return null;
  const exit = async () => {
    setBusy(true);
    try { const { accessToken } = await api.stopImpersonation(); auth.set(accessToken); window.location.href = '/admin/agencies'; }
    catch { setBusy(false); }
  };
  return (
    <div style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderRadius: '1rem', border: '1px solid #FCD34D', background: '#FEF3C7', color: '#92400E', padding: '10px 16px', fontSize: 14 }}>
      {/* The agency name was bold inline; the sentence now comes from the
          catalogue as one string, because a translator cannot reorder a clause
          that is split across JSX elements. Emphasis moved to the whole line. */}
      <span><b>{t('shell.impersonating', { agency: actor.agency, platform: b.name })}</b></span>
      <button onClick={exit} disabled={busy}
        style={{ borderRadius: 8, background: '#92400E', color: '#fff', padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1, border: 0 }}>
        {busy ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  );
}

function BrandMark({ size = 34, dark = false }: { size?: number; dark?: boolean }) {
  const b = useBrand();
  // On the dark sidebar the ink wordmark disappears, so prefer the brand's
  // inverse mark there — the same one the public rentals footer uses.
  const wide = dark ? (b.logo.inverseUrl || b.logo.wordmarkUrl) : b.logo.wordmarkUrl;
  // A wide wordmark stands alone (no tile, no separate name).
  if (wide) {
    return <img src={wide} alt={b.name} style={{ height: size * 0.82 }} className="w-auto" />;
  }
  return (
    <div className="flex items-center gap-2.5">
      {b.logo.imageUrl ? (
        <img src={dark ? (b.logo.inverseUrl || b.logo.imageUrl) : b.logo.imageUrl} alt="" width={size} height={size} className="rounded-xl object-contain" />
      ) : (
        <span className="grid place-items-center rounded-xl font-heading font-bold text-onbrand shadow-soft"
          style={{ width: size, height: size, background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 88%, white), var(--brand))' }}>
          {b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
        </span>
      )}
      <span className={cn('font-heading text-[17px] font-bold', dark ? 'text-white' : 'text-ink')}>{b.logo.text}</span>
    </div>
  );
}

/**
 * Says where this installation runs, but only when that is worth saying.
 *
 * Nothing shows on a private server, which is every deployment today — a chip
 * reading "Private server" on an agency's own screen is noise about plumbing
 * they did not ask about. On-site, it is the opposite: the client paid for the
 * machine being in their building and the demo turns on them seeing it.
 *
 * Unbranded, and coloured from --brand, per the white-label rule.
 */
function DeploymentChip() {
  const { profile } = useDeployment();
  const t = useT();
  if (!isOnSite(profile)) return null;
  return (
    <div className="mx-2 mt-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/80">
      {t(`deployment.${profile}` as MessageKey)}
    </div>
  );
}


function NavLinks({ onNavigate, items = NAV }: { onNavigate?: () => void; items?: readonly NavItem[] }) {
  const path = usePathname();
  const t = useT();
  const { capabilities } = useDeployment();
  // An entry tagged with a capability the mode does not serve is absent, not
  // disabled: the API refuses those routes, so a greyed-out link would be a
  // control that leads nowhere. Untagged entries are staff work and show in
  // every mode, which is the whole premise of the sealed option.
  const visible = items.filter((i) => !i.requires || capabilities[i.requires]);
  return (
    <nav className="flex flex-col gap-1">
      {visible.map(({ href, key, icon: Icon }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} onClick={onNavigate}
            className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active ? 'text-onbrand shadow-soft' : 'text-white/70 hover:text-white hover:bg-white/10')}
            style={active ? { background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 90%, white), var(--brand))' } : undefined}>
            <Icon size={18} className={active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const t = useT();
  return (
    <button onClick={async () => { await api.logout().catch(() => {}); auth.clear(); onDone?.(); router.replace('/login'); }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-red-300">
      <LogOut size={18} /> {t('shell.signOut')}
    </button>
  );
}

function Footer() {
  const b = useBrand();
  const c = b.contact;
  return (
    <footer className="mt-10 border-t border-line pt-6 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-semibold text-ink">{b.name}</span>
        {c.phone && <a href={`tel:${c.phone}`} className="hover:text-brand">{c.phone}</a>}
        {c.email && <a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a>}
        {c.website && <a href={`https://${c.website}`} target="_blank" rel="noreferrer" className="hover:text-brand">{c.website}</a>}
      </div>
    </footer>
  );
}

/**
 * Pre-hydration placeholder. Kept deliberately text-first: this is the only
 * markup a crawler (or Google's brand-verification reviewer) sees on app.<domain>,
 * so it names the app and states its purpose instead of rendering a blank page.
 */
function BrandSplash() {
  const b = useBrand();
  const t = useT();
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{b.name}</h1>
        {b.tagline && <p className="mt-2 text-sm text-muted">{b.tagline}</p>}
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          {t('shell.splash.blurb', { brand: b.name })}
        </p>
      </div>
    </main>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  // Auth lives in browser storage, so the server can't know whether to show the
  // authed chrome. Waiting for mount stops the server from rendering a sidebar
  // that the client immediately throws away on redirect to /login.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Login, payment-return, and the public rentals/sign pages render bare (no
  // sidebar / auth chrome) and don't require a session.
  const isPublic =
    path === '/login' ||
    path === '/no-access' ||
    path.startsWith('/auth/google') ||
    path === '/signup' ||
    path === '/partner-apply' ||
    path.startsWith('/partner-apply/') ||
    path.startsWith('/pay/') ||
    path === '/rentals' ||
    path.startsWith('/rentals/') ||
    path.startsWith('/l/') ||
    path.startsWith('/sign/');

  // Gate every authed route: no token → straight to login. Runs on first paint
  // and on every navigation, so a signed-out/expired session can't view a page.
  useEffect(() => {
    if (!isPublic && typeof window !== 'undefined' && !auth.get()) {
      router.replace('/login');
    }
  }, [path, isPublic, router]);

  if (isPublic) return <main className="min-h-screen">{children}</main>;
  // Never SSR the authed shell (see `mounted` above). Render a branded splash
  // rather than nothing: it's what crawlers and Google's OAuth brand-verification
  // reviewer see on this domain, so it must name the app and say what it does.
  if (!mounted) return <BrandSplash />;
  if (!auth.get()) return null; // avoid flashing protected content pre-redirect
  const nav = path.startsWith('/admin') ? ADMIN_NAV
    : path.startsWith('/partner') ? PARTNER_NAV
    : path.startsWith('/portal') ? PORTAL_NAV
    : NAV;

  return (
    <div className="min-h-screen lg:pl-[264px]">
      <IdleTimeout />
      {nav === PARTNER_NAV && <AssistantPanel />}
      {/* Desktop sidebar */}
      <aside className="sidebar-dark fixed inset-y-3 left-3 z-30 hidden w-[248px] flex-col justify-between rounded-3xl p-4 lg:flex">
        <div>
          <div className="px-2 py-3"><BrandMark dark /></div>
          <DeploymentChip />
          <div className="mt-4"><NavLinks items={nav} /></div>
        </div>
        <div className="border-t border-white/10 pt-3">
          <LocaleSwitcher />
          <SignOut />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between rounded-none px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label={t('shell.openMenu')} className="grid h-9 w-9 place-items-center rounded-xl text-ink hover:bg-black/5"><Menu size={20} /></button>
        <BrandMark size={30} />
        <button onClick={() => router.push('/notifications')} aria-label={t('shell.notifications')} className="grid h-9 w-9 place-items-center rounded-xl text-ink hover:bg-black/5"><Bell size={18} /></button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-up" onClick={() => setOpen(false)} />
          <div className="sidebar-dark absolute inset-y-0 left-0 flex w-[80%] max-w-[300px] flex-col justify-between rounded-r-3xl p-4">
            <div>
              <div className="flex items-center justify-between px-2 py-2">
                <BrandMark size={30} dark />
                <button onClick={() => setOpen(false)} aria-label={t('shell.closeMenu')} className="grid h-9 w-9 place-items-center rounded-xl text-white hover:bg-white/10"><X size={18} /></button>
              </div>
              <div className="mt-4"><NavLinks items={nav} onNavigate={() => setOpen(false)} /></div>
            </div>
            <div className="border-t border-white/10 pt-3">
              <LocaleSwitcher />
              <SignOut onDone={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <ImpersonationBanner />
        {children}
        <Footer />
      </main>
    </div>
  );
}
