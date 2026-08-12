'use client';
import Link from 'next/link';
import { useBrand } from './brand-provider';
import { isPlatformHost } from '@/lib/branding';

/** Branded header for the public rentals site (no auth chrome). */
export function PublicHeader() {
  const b = useBrand();
  return (
    <header className="glass sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6">
      <Link href="/rentals" className="flex items-center gap-2.5">
        {b.logo.imageUrl ? (
          <img src={b.logo.imageUrl} alt="" className="h-9 w-9 rounded-xl object-contain" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-xl font-heading font-bold text-onbrand"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 88%, white), var(--brand))' }}>
            {b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
          </span>
        )}
        <span className="font-heading text-[17px] font-bold text-ink">{b.logo.text}</span>
      </Link>
      {b.contact?.phone && (
        <a href={`tel:${b.contact.phone}`} className="text-sm font-medium text-brand">{b.contact.phone}</a>
      )}
    </header>
  );
}

export function PublicFooter() {
  const b = useBrand();
  const c = b.contact ?? {};
  // Attribution appears on agency-branded pages only — never on Locare's own
  // host, where "Powered by Locare" would be circular.
  const showAttribution = typeof window !== 'undefined' && !isPlatformHost();
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-xs text-muted sm:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-6">
        <span className="font-semibold text-ink">{b.name}</span>
        {c.phone && <a href={`tel:${c.phone}`} className="hover:text-brand">{c.phone}</a>}
        {c.email && <a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a>}
        {c.website && <a href={`https://${c.website}`} target="_blank" rel="noreferrer" className="hover:text-brand">{c.website}</a>}
        {showAttribution && (
          <span className="ml-auto">
            Powered by{' '}
            <a href="https://locare.co.za" target="_blank" rel="noopener" className="font-medium hover:text-brand">Locare</a>
          </span>
        )}
      </div>
    </footer>
  );
}

/** Best-effort formatting of the free-form property address jsonb. */
export function formatAddress(a: any): string {
  if (!a || typeof a !== 'object') return '';
  const parts = [a.suburb, a.city, a.province].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return [a.line1, a.street, a.town].filter(Boolean).join(', ');
}

export function formatDate(d?: string): string {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
