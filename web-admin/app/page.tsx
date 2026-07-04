'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';

const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');
const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rentRoll, setRentRoll] = useState<any[]>([]);
  const [arrears, setArrears] = useState<any>(null);
  const [period, setPeriod] = useState(thisPeriod());
  const [collection, setCollection] = useState<any>(null);
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
      const [rr, ar, col] = await Promise.all([api.rentRoll(), api.arrears(), api.collection(period)]);
      setRentRoll(rr); setArrears(ar); setCollection(col);
    } catch (e: any) { setErr(e.message); }
  };

  const runBilling = async () => {
    setBusy(true); setErr('');
    try {
      await api.runBilling(period, `${period}-07`);
      setTimeout(load, 1200);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!ready) return null;
  const occupied = rentRoll.length;

  return (
    <div className="container">
      <div className="h1">Dashboard</div>
      <p className="sub">Portfolio overview — all figures scoped to your vendor</p>
      {err && <div className="err">{err}</div>}

      <div className="metrics">
        <div className="metric"><div className="label">Active leases</div><div className="value">{occupied}</div></div>
        <div className="metric"><div className="label">Collected · {period}</div><div className="value">{collection ? money(collection.collected) : '—'}</div></div>
        <div className="metric accent"><div className="label">Collection rate</div><div className="value">{collection ? `${collection.collectionRate}%` : '—'}</div></div>
        <div className="metric"><div className="label">Outstanding</div><div className="value">{arrears ? money(arrears.total) : '—'}</div></div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <label>Billing period</label>
            <input style={{ width: 140 }} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn secondary" onClick={load}>Refresh</button>
            <button className="btn" onClick={runBilling} disabled={busy}>{busy ? 'Running…' : 'Run billing'}</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h1" style={{ fontSize: 16, marginBottom: 12 }}>Rent roll</div>
        <table>
          <thead><tr><th>Unit</th><th>Rent</th><th>Status</th><th>Outstanding</th></tr></thead>
          <tbody>
            {rentRoll.map((r) => (
              <tr key={r.lease_id}>
                <td>{r.unit}</td>
                <td>{money(r.rent_amount)}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>{Number(r.outstanding) > 0 ? <span className="badge warn">{money(r.outstanding)}</span> : money(0)}</td>
              </tr>
            ))}
            {rentRoll.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No active leases.</td></tr>}
          </tbody>
        </table>
      </div>

      {arrears && (
        <div className="card">
          <div className="h1" style={{ fontSize: 16, marginBottom: 4 }}>Outstanding by age</div>
          <p className="sub" style={{ marginBottom: 12 }}>
            “Not yet due” is billed but not past its due date. Arrears is the overdue portion. The columns reconcile to the total.
          </p>
          <table>
            <thead><tr><th>Not yet due</th><th>0–30</th><th>31–60</th><th>61–90</th><th>90+</th><th>Arrears</th><th>Total</th></tr></thead>
            <tbody><tr>
              <td>{money(arrears.notYetDue)}</td>
              <td>{money(arrears['0-30'])}</td><td>{money(arrears['31-60'])}</td>
              <td>{money(arrears['61-90'])}</td><td>{money(arrears['90+'])}</td>
              <td>{arrears.arrears > 0 ? <span className="badge warn">{money(arrears.arrears)}</span> : money(0)}</td>
              <td><strong>{money(arrears.total)}</strong></td>
            </tr></tbody>
          </table>
        </div>
      )}
    </div>
  );
}
