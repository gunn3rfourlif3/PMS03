'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';

const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');

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

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    load();
  }, []);

  const load = async () => {
    setErr('');
    try {
      const [pub, u] = await Promise.all([api.publishedListings(), api.units()]);
      setListings(pub); setUnits(u);
      if (!unitId && u[0]) setUnitId(u[0].id);
    } catch (e: any) { setErr(e.message); }
  };

  const create = async () => {
    setBusy(true); setErr('');
    try {
      const l = await api.createListing({ unitId, advertisedRent: Number(rent), availableFrom, description: 'Listed via back-office' });
      await api.publishListing(l.id);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div className="container">
      <div className="h1">Listings</div>
      <p className="sub">Create and publish vacancies</p>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <div className="h1" style={{ fontSize: 16, marginBottom: 8 }}>New listing</div>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Unit</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--line)' }}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label} · {u.status}</option>)}
            </select>
          </div>
          <div><label>Rent</label><input style={{ width: 120 }} value={rent} onChange={(e) => setRent(e.target.value)} /></div>
          <div><label>Available from</label><input style={{ width: 150 }} value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></div>
          <button className="btn" onClick={create} disabled={busy || !unitId}>{busy ? '…' : 'Create + publish'}</button>
        </div>
      </div>

      <div className="card">
        <div className="h1" style={{ fontSize: 16, marginBottom: 12 }}>Published</div>
        <table>
          <thead><tr><th>Rent</th><th>Available</th><th>Status</th><th>Description</th></tr></thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id}>
                <td>{money(l.advertisedRent)}</td>
                <td>{l.availableFrom}</td>
                <td><span className="badge">{l.status}</span></td>
                <td>{l.description}</td>
              </tr>
            ))}
            {listings.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No published listings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
