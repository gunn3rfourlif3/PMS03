'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';

const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');
const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function OwnersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [owners, setOwners] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [fee, setFee] = useState('0.10');
  const [period, setPeriod] = useState(thisPeriod());
  const [statement, setStatement] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    load();
  }, []);

  const load = async () => {
    setErr('');
    try { setOwners(await api.owners()); }
    catch (e: any) { setErr(e.message); }
  };

  const create = async () => {
    setBusy(true); setErr('');
    try { await api.createOwner({ name, managementFeePct: Number(fee) }); setName(''); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const generate = async (ownerId: string) => {
    setErr(''); setStatement(null);
    try { setStatement(await api.generateStatement(ownerId, period)); }
    catch (e: any) { setErr(e.message); }
  };

  const payout = async () => {
    if (!statement) return;
    setBusy(true); setErr('');
    try { const p = await api.payoutStatement(statement.id); setStatement({ ...statement, status: 'paid_out', payoutRef: p.gatewayRef }); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div className="container">
      <div className="h1">Owners</div>
      <p className="sub">Manage owners, generate statements, and pay out</p>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <div className="h1" style={{ fontSize: 16, marginBottom: 8 }}>Add owner</div>
        <div className="row">
          <div style={{ flex: 2 }}><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Property Holdings" /></div>
          <div><label>Mgmt fee (fraction)</label><input style={{ width: 140 }} value={fee} onChange={(e) => setFee(e.target.value)} /></div>
          <button className="btn" onClick={create} disabled={busy || !name}>Add</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="h1" style={{ fontSize: 16 }}>Owners</div>
          <div><label>Statement period</label><input style={{ width: 120 }} value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Mgmt fee</th><th>Payout account</th><th></th></tr></thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{Math.round(Number(o.managementFeePct) * 100)}%</td>
                <td>{o.payoutSubaccount || '—'}</td>
                <td><button className="btn secondary" onClick={() => generate(o.id)}>Generate statement</button></td>
              </tr>
            ))}
            {owners.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No owners yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {statement && (
        <div className="card">
          <div className="h1" style={{ fontSize: 16, marginBottom: 12 }}>Statement · {statement.period}</div>
          <div className="metrics">
            <div className="metric"><div className="label">Gross collected</div><div className="value">{money(statement.grossCollected)}</div></div>
            <div className="metric"><div className="label">Management fee</div><div className="value">{money(statement.managementFee)}</div></div>
            <div className="metric"><div className="label">Expenses</div><div className="value">{money(statement.expenses)}</div></div>
            <div className="metric"><div className="label">Net payout</div><div className="value">{money(statement.netPayout)}</div></div>
          </div>
          {statement.status === 'paid_out'
            ? <span className="badge">Paid out</span>
            : <button className="btn" onClick={payout} disabled={busy || Number(statement.netPayout) <= 0}>Pay out {money(statement.netPayout)}</button>}
        </div>
      )}
    </div>
  );
}
