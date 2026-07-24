'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Copy, Check, ExternalLink } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, money } from '@/components/ui';

/** Public rentals URL for a listing, derived from the current host (app.<domain> -> rentals.<domain>). */
function rentalsUrl(listingId: string): string {
  if (typeof window === 'undefined') return '';
  const h = window.location.hostname.split('.');
  const base = h.length > 2 ? h.slice(1).join('.') : window.location.hostname;
  return `${window.location.protocol}//rentals.${base}/l/${listingId}`;
}

export default function ListingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [unitId, setUnitId] = useState('');
  const [rent, setRent] = useState('8000');
  const [availableFrom, setAvailableFrom] = useState('2026-08-01');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = async (id: string) => {
    const url = rentalsUrl(id);
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
  };

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);

  const load = async () => {
    setErr('');
    try {
      const [all, u] = await Promise.all([api.allListings(), api.units()]);
      setListings(all);
      const vacant = u.filter((x: any) => x.status === 'vacant');
      setUnits(vacant);
      if (!unitId && vacant[0]) setUnitId(vacant[0].id);
    } catch (e: any) { setErr(e.message); }
  };
  const create = async () => {
    setBusy(true); setErr('');
    try {
      const l = await api.createListing({ unitId, advertisedRent: Number(rent), availableFrom, description: 'Listed via back-office' });
      await api.publishListing(l.id); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Listings" subtitle="Create and publish vacancies" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">New listing</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Unit">
              <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                {units.length === 0 && <option value="">No vacant units</option>}
                {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-32"><Field label="Rent"><input className="input" value={rent} onChange={(e) => setRent(e.target.value)} /></Field></div>
          <div className="w-44"><Field label="Available from"><input className="input" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></Field></div>
          <Button onClick={create} loading={busy} disabled={!unitId}><Plus size={16} /> Create &amp; publish</Button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-lg font-bold">All listings</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Rent</th><th className="px-5 py-3 font-semibold">Available</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Description</th><th className="px-5 py-3 font-semibold">Share</th>
            </tr></thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-white/40 hover:bg-white/30">
                  <td className="px-5 py-3 font-medium">{money(l.advertisedRent)}</td>
                  <td className="px-5 py-3">{l.availableFrom}</td>
                  <td className="px-5 py-3"><Badge tone={l.status === 'published' ? 'success' : l.status === 'filled' ? 'brand' : 'muted'}>{l.status}</Badge></td>
                  <td className="px-5 py-3 text-muted">{l.description}</td>
                  <td className="px-5 py-3">
                    {l.status === 'published' ? (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" onClick={() => copyLink(l.id)}>
                          {copied === l.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
                        </Button>
                        <a href={rentalsUrl(l.id)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/40 hover:text-brand" title="Open public page"><ExternalLink size={15} /></a>
                      </div>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
              {listings.length === 0 && <tr><td colSpan={5}><EmptyState>No listings yet — create one above.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
