'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { Plus, Copy, Check, ExternalLink, Play, Pause, Ban, Image as ImageIcon, X, Upload } from 'lucide-react';
import { api, auth, thumbUrl } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, BentoTile, money } from '@/components/ui';

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
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  // Photos modal
  const [photoFor, setPhotoFor] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [upBusy, setUpBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const openPhotos = (l: any) => { setPhotoFor(l); setPhotos(l.media ?? []); setPhotoErr(''); };
  const uploadPhoto = async (file?: File) => {
    if (!file || !photoFor) return;
    setUpBusy(true); setPhotoErr('');
    try { const media = await api.addListingPhoto(photoFor.id, file); setPhotos(media); await load(); }
    catch (e: any) { setPhotoErr(e.message); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const deletePhoto = async (url: string) => {
    if (!photoFor) return;
    setPhotoErr('');
    try { const media = await api.removeListingPhoto(photoFor.id, url); setPhotos(media); await load(); }
    catch (e: any) { setPhotoErr(e.message); }
  };

  const changeStatus = async (id: string, status: 'draft' | 'published' | 'paused' | 'closed') => {
    setStatusBusy(id + status); setErr('');
    try { await api.setListingStatus(id, status); await load(); }
    catch (e: any) { setErr(e.message); } finally { setStatusBusy(null); }
  };

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
      // A unit with an existing open listing (draft/published/paused) can't be re-listed.
      const openUnitIds = new Set(
        all.filter((l: any) => ['draft', 'published', 'paused'].includes(l.status)).map((l: any) => l.unitId),
      );
      const available = u.filter((x: any) => x.status === 'vacant' && !openUnitIds.has(x.id));
      setUnits(available);
      if (available.every((x: any) => x.id !== unitId)) setUnitId(available[0]?.id ?? '');
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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="green" value={String(listings.filter((l) => l.status === 'published').length)} label="Published" />
        <BentoTile tone="purple" value={String(listings.filter((l) => l.status === 'draft').length)} label="Draft" />
        <BentoTile tone="amber" value={String(listings.filter((l) => l.status === 'paused').length)} label="Paused" />
        <BentoTile tone="blue" value={String(listings.length)} label="Total" />
      </div>

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
              <th className="px-5 py-3 font-semibold">Rent</th><th className="px-5 py-3 font-semibold">Available</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Description</th><th className="px-5 py-3 font-semibold">Share</th><th className="px-5 py-3 font-semibold">Manage</th>
            </tr></thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-line hover:bg-black/[0.02]">
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
                        <a href={rentalsUrl(l.id)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-black/5 hover:text-brand" title="Open public page"><ExternalLink size={15} /></a>
                      </div>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" onClick={() => openPhotos(l)}><ImageIcon size={14} /> Photos{l.media?.length ? ` (${l.media.length})` : ''}</Button>
                      {['draft', 'paused', 'closed'].includes(l.status) && (
                        <Button variant="ghost" onClick={() => changeStatus(l.id, 'published')} loading={statusBusy === l.id + 'published'}><Play size={14} /> Publish</Button>
                      )}
                      {l.status === 'published' && (
                        <Button variant="ghost" onClick={() => changeStatus(l.id, 'paused')} loading={statusBusy === l.id + 'paused'}><Pause size={14} /> Pause</Button>
                      )}
                      {['published', 'paused'].includes(l.status) && (
                        <Button variant="ghost" onClick={() => changeStatus(l.id, 'closed')} loading={statusBusy === l.id + 'closed'}><Ban size={14} /> Close</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {listings.length === 0 && <tr><td colSpan={6}><EmptyState>No listings yet — create one above.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={!!photoFor} onClose={() => setPhotoFor(null)} title="Listing photos"
        footer={<Button variant="ghost" onClick={() => setPhotoFor(null)}>Done</Button>}>
        {photoErr && <div className="mb-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{photoErr}</div>}
        {photos.length === 0 ? (
          <p className="mb-4 text-sm text-muted">No photos yet. Add a few to show this listing off on your rentals site.</p>
        ) : (
          <div className="mb-4 grid grid-cols-3 gap-3">
            {photos.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
                <img src={thumbUrl(url)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = url; }} alt="" className="h-full w-full object-cover" />
                <button onClick={() => deletePhoto(url)} title="Remove"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-danger">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => uploadPhoto(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} loading={upBusy}><Upload size={15} /> Upload photo</Button>
        <p className="mt-2 text-xs text-muted">JPG, PNG or WebP · up to 10MB. The first photo is used as the cover.</p>
      </Modal>
    </div>
  );
}
