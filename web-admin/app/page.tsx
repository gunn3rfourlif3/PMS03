'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Banknote, AlertTriangle, RefreshCw, Play } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Metric, Progress, Button, Field, Badge, EmptyState, money } from '@/components/ui';

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
    setReady(true); load();
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
    try { await api.runBilling(period, `${period}-07`); setTimeout(load, 1200); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const rate = collection ? Number(collection.collectionRate) : 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Portfolio overview — every figure scoped to your vendor" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Active leases" value={rentRoll.length} icon={<Building2 size={18} />} />
        <Metric label={`Collected · ${period}`} value={collection ? money(collection.collected) : '—'} icon={<Banknote size={18} />} />
        <Metric label="Outstanding" value={arrears ? money(arrears.total) : '—'} tone={arrears && arrears.arrears > 0 ? 'danger' : undefined} icon={<AlertTriangle size={18} />} />
        <Metric label="Collection rate" value={collection ? `${rate}%` : '—'} accent />
      </div>

      <GlassCard className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted">Collection rate · {period}</span>
          <span className="font-heading font-bold text-brand">{rate}%</span>
        </div>
        <Progress value={rate} />
      </GlassCard>

      <GlassCard className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="w-40"><Field label="Billing period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field></div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load}><RefreshCw size={16} /> Refresh</Button>
          <Button onClick={runBilling} loading={busy}><Play size={16} /> Run billing</Button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-lg font-bold">Rent roll</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Unit</th><th className="px-5 py-3 font-semibold">Rent</th>
                <th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rentRoll.map((r) => (
                <tr key={r.lease_id} className="border-t border-white/40 hover:bg-white/30">
                  <td className="px-5 py-3 font-medium">{r.unit}</td>
                  <td className="px-5 py-3">{money(r.rent_amount)}</td>
                  <td className="px-5 py-3"><Badge tone={r.status === 'active' ? 'success' : 'muted'}>{r.status}</Badge></td>
                  <td className="px-5 py-3">{Number(r.outstanding) > 0 ? <Badge tone="danger">{money(r.outstanding)}</Badge> : money(0)}</td>
                </tr>
              ))}
              {rentRoll.length === 0 && <tr><td colSpan={4}><EmptyState>No active leases.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {arrears && (
        <GlassCard className="mt-4 !p-0 overflow-hidden">
          <div className="px-5 pt-5 font-heading text-lg font-bold">Outstanding by age</div>
          <p className="px-5 pt-1 text-sm text-muted">“Not yet due” is billed but not past due. Arrears is the overdue portion. Columns reconcile to the total.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  {['Not yet due','0–30','31–60','61–90','90+','Arrears','Total'].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/40">
                  <td className="px-5 py-3">{money(arrears.notYetDue)}</td>
                  <td className="px-5 py-3">{money(arrears['0-30'])}</td>
                  <td className="px-5 py-3">{money(arrears['31-60'])}</td>
                  <td className="px-5 py-3">{money(arrears['61-90'])}</td>
                  <td className="px-5 py-3">{money(arrears['90+'])}</td>
                  <td className="px-5 py-3">{arrears.arrears > 0 ? <Badge tone="danger">{money(arrears.arrears)}</Badge> : money(0)}</td>
                  <td className="px-5 py-3 font-bold">{money(arrears.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
