'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, Tags, ClipboardList, ClipboardCheck, CalendarClock, Users, Wrench, BarChart3, FileText, KeyRound, Settings as SettingsIcon, LogOut, Menu, X, Bell, MessageSquare, LayoutGrid, Receipt, Landmark, FileUp, Handshake, Columns3, Activity, Trophy, CreditCard } from 'lucide-react';
import { auth, api, actorFromToken } from '@/lib/api';
import { useBrand } from './brand-provider';
import IdleTimeout from './idle-timeout';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/leases', label: 'Leases', icon: CalendarClock },
  { href: '/lease-parsing', label: 'Import lease', icon: FileUp },
  { href: '/payments', label: 'Payments', icon: Receipt },
  { href: '/listings', label: 'Listings', icon: Tags },
  { href: '/applications', label: 'Applications', icon: ClipboardList },
  { href: '/owners', label: 'Owners', icon: Users },
  { href: '/agents', label: 'Agents', icon: Handshake },
  { href: '/providers', label: 'Providers', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/inspections', label: 'Inspections', icon: ClipboardCheck },
  { href: '/api-keys', label: 'API keys', icon: KeyRound },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const PORTAL_NAV = [
  { href: '/portal', label: 'Overview', icon: LayoutGrid },
  { href: '/portal/statements', label: 'Statements', icon: Receipt },
  { href: '/portal/properties', label: 'Properties', icon: Building2 },
  { href: '/portal/banking', label: 'Banking', icon: Landmark },
];

const PARTNER_NAV = [
  { href: '/partner', label: 'Overview', icon: LayoutGrid },
  { href: '/partner/pipeline', label: 'Pipeline', icon: Columns3 },
  { href: '/partner/activity', label: 'Activity', icon: Activity },
  { href: '/partner/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/partner/agencies', label: 'Agencies', icon: Building2 },
  { href: '/partner/commissions', label: 'Commissions', icon: Receipt },
  { href: '/partner/banking', label: 'Banking', icon: Landmark },
];

const ADMIN_NAV = [
  { href: '/admin/agencies', label: 'Agencies', icon: Building2 },
  { href: '/admin/partners', label: 'Partners', icon: Handshake },
  { href: '/admin/partner-applications', label: 'Applications', icon: ClipboardCheck },
  { href: '/admin/commissions', label: 'Commissions', icon: Receipt },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
];

/** Shown whenever the session token carries an impersonation `act` claim. */
function ImpersonationBanner() {
  const [busy, setBusy] = useState(false);
  const actor = actorFromToken();
  if (!actor) return null;
  const exit = async () => {
    setBusy(true);
    try { const { accessToken } = await api.stopImpersonation(); auth.set(accessToken); window.location.href = '/admin/agencies'; }
    catch { setBusy(false); }
  };
  return (
    <div style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderRadius: '1rem', border: '1px solid #FCD34D', background: '#FEF3C7', color: '#92400E', padding: '10px 16px', fontSize: 14 }}>
      <span>Viewing <b>{actor.agency}</b> as Locare support — you’re acting on this agency’s live data.</span>
      <button onClick={exit} disabled={busy}
        style={{ borderRadius: 8, background: '#92400E', color: '#fff', padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1, border: 0 }}>
        {busy ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  );
}

function BrandMark({ size = 34 }: { size?: number }) {
  const b = useBrand();
  // A wide wordmark stands alone (no tile, no separate name).
  if (b.logo.wordmarkUrl) {
    return <img src={b.logo.wordmarkUrl} alt={b.name} style={{ height: size * 0.82 }} className="w-auto" />;
  }
  return (
    <div className="flex items-center gap-2.5">
      {b.logo.imageUrl ? (
        <img src={b.logo.imageUrl} alt="" width={size} height={size} className="rounded-xl object-contain" />
      ) : (
        <span className="grid place-items-center rounded-xl font-heading font-bold text-onbrand shadow-soft"
          style={{ width: size, height: size, background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 88%, white), var(--brand))' }}>
          {b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
        </span>
      )}
      <span className="font-heading text-[17px] font-bold text-ink">{b.logo.text}</span>
    </div>
  );
}

function NavLinks({ onNavigate, items = NAV }: { onNavigate?: () => void; items?: typeof NAV }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} onClick={onNavigate}
            className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active ? 'text-onbrand shadow-soft' : 'text-ink/70 hover:text-ink hover:bg-black/5')}
            style={active ? { background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 90%, white), var(--brand))' } : undefined}>
            <Icon size={18} className={active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  return (
    <button onClick={async () => { await api.logout().catch(() => {}); auth.clear(); onDone?.(); router.replace('/login'); }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-black/5 hover:text-danger">
      <LogOut size={18} /> Sign out
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
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{b.name}</h1>
        {b.tagline && <p className="mt-2 text-sm text-muted">{b.tagline}</p>}
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          {b.name} is a property-management platform for rental agencies — leasing,
          rent collection, trust accounting, owner payouts and maintenance. Sign in
          to continue to your back-office.
        </p>
      </div>
    </main>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
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
      {/* Desktop sidebar */}
      <aside className="glass-strong fixed inset-y-3 left-3 z-30 hidden w-[248px] flex-col justify-between rounded-3xl p-4 lg:flex">
        <div>
          <div className="px-2 py-3"><BrandMark /></div>
          <div className="mt-4"><NavLinks items={nav} /></div>
        </div>
        <div className="border-t border-line pt-3"><SignOut /></div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between rounded-none px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl text-ink hover:bg-black/5"><Menu size={20} /></button>
        <BrandMark size={30} />
        <button onClick={() => router.push('/notifications')} className="grid h-9 w-9 place-items-center rounded-xl text-ink hover:bg-black/5"><Bell size={18} /></button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-up" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute inset-y-0 left-0 flex w-[80%] max-w-[300px] flex-col justify-between rounded-r-3xl p-4">
            <div>
              <div className="flex items-center justify-between px-2 py-2">
                <BrandMark size={30} />
                <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5"><X size={18} /></button>
              </div>
              <div className="mt-4"><NavLinks items={nav} onNavigate={() => setOpen(false)} /></div>
            </div>
            <div className="border-t border-line pt-3"><SignOut onDone={() => setOpen(false)} /></div>
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
