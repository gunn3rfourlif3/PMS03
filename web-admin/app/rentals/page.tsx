'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, thumbUrl } from '@/lib/api';
import { brandKey } from '@/lib/branding';
import { useBrand } from '@/components/brand-provider';
import { GlassCard, Button, Badge, EmptyState, money } from '@/components/ui';
import { PublicHeader, PublicFooter, formatAddress, formatDate } from '@/components/public-chrome';

export default function RentalsPage() {
  const b = useBrand();
  const [listings, setListings] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.publicListings(brandKey())
      .then((rows) => setListings(rows || []))
      .catch((e) => { setErr(e.message); setListings([]); });
  }, []);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-ink sm:text-3xl">Available rentals</h1>
        <p className="mb-6 text-sm text-muted">{b.tagline ?? 'Find your next home.'}</p>

        {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

        {listings === null ? (
          <p className="text-muted">Loading listings…</p>
        ) : listings.length === 0 ? (
          <EmptyState>No rentals available right now — please check back soon.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const loc = formatAddress(l.address);
              return (
                <Link key={l.id} href={`/l/${l.id}`} className="block">
                  <GlassCard className="flex h-full flex-col transition hover:shadow-lg">
                    {l.media?.[0] && <img src={thumbUrl(l.media[0])} onError={(e) => { (e.currentTarget as HTMLImageElement).src = l.media[0]; }} alt={l.propertyName} className="mb-3 h-44 w-full rounded-xl object-cover" />}
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-heading text-lg font-bold text-ink">{l.propertyName}</div>
                      <Badge tone="success">Available</Badge>
                    </div>
                    <div className="text-sm text-muted">{l.unitLabel}{loc ? ` · ${loc}` : ''}</div>
                    <div className="mt-3 text-2xl font-bold text-brand">{money(l.rent)}<span className="text-sm font-normal text-muted">/mo</span></div>
                    <div className="mt-1 text-sm text-muted">{l.bedrooms} bed · {l.bathrooms} bath · from {formatDate(l.availableFrom)}</div>
                    {l.description && <p className="mt-3 line-clamp-3 text-sm text-ink/80">{l.description}</p>}
                    <div className="mt-4 pt-1"><Button className="w-full">View &amp; apply</Button></div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
