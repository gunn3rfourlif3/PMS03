'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Donut, BentoTile, money } from '@/components/ui';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

function downloadCsv(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) { rows = [{ note: 'no data' }]; }
  const cols = Array.from(rows.reduce((set: Set<string>, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set<string>()));
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState(thisPeriod());
  const [income, setIncome] = useState<any>(null);
  const [collection, setCollection] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); /* eslint-disable-next-line */ }, []);

  const [running, setRunning] = useState(false);
  const load = async () => {
    setErr(''); setRunning(true);
    try {
      const [inc, col] = await Promise.all([api.income(period), api.collection(period)]);
      setIncome(inc); setCollection(col);
    } catch (e: any) { setErr(e.message); } finally { setRunning(false); }
  };

  const exportCsv = async (kind: 'rent-roll' | 'arrears' | 'collection') => {
    setBusy(true); setErr('');
    try {
      if (kind === 'rent-roll') downloadCsv(`rent-roll-${period}.csv`, await api.rentRoll());
      else if (kind === 'arrears') { const a = await api.arrears(); downloadCsv(`arrears-${period}.csv`, [a]); }
      else downloadCsv(`collection-${period}.csv`, [await api.collection(period)]);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const rate = collection ? Math.round(Number(collection.collectionRate)) : 0;
  const chartData = income ? [
    { name: 'Rent collected', value: Number(income.rentCollected), fill: '#1D9E75' },
    { name: 'Mgmt fees', value: Number(income.managementFees), fill: '#378ADD' },
    { name: 'Expenses', value: Number(income.expenses), fill: '#D85A30' },
    { name: 'Net operating', value: Number(income.netOperating), fill: '#534AB7' },
  ] : [];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Period income statement and data exports"
        action={<div className="flex items-end gap-2">
          <div className="w-32"><Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" /></Field></div>
          <Button onClick={load} loading={running}><RefreshCw size={16} /> Run</Button>
        </div>} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="teal" value={income ? money(income.rentCollected) : '—'} label="Rent collected" />
        <BentoTile tone="blue" value={income ? money(income.managementFees) : '—'} label="Management fees" />
        <BentoTile tone="coral" value={income ? money(income.expenses) : '—'} label="Expenses" />
        <BentoTile tone="purple" value={income ? money(income.netOperating) : '—'} label="Net operating" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-1 font-heading text-base font-bold text-ink">Income breakdown · {period}</div>
          <p className="mb-3 text-sm text-muted">Cash basis — rent collected plus management-fee income, less expenses incurred.</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v) => 'R' + (v / 1000) + 'k'} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: 'var(--ink)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={26}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col items-center justify-center gap-3">
          <Donut value={rate} tone="teal" size={140} sub="collected" />
          <div className="text-center">
            <div className="font-heading text-base font-bold text-ink">Collection rate</div>
            <div className="text-sm text-muted">{collection ? `${money(collection.collected)} of ${money(collection.billed)}` : '—'}</div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-3">
        <div className="mb-3 font-heading text-base font-bold text-ink">Income statement · {period}</div>
        <div className="divide-y divide-line text-sm">
          <Row label="Rent collected" value={income ? money(income.rentCollected) : '—'} />
          <Row label="Management fee income" value={income ? money(income.managementFees) : '—'} />
          <Row label="Expenses" value={income ? `(${money(income.expenses)})` : '—'} danger />
          <Row label="Net operating income" value={income ? money(income.netOperating) : '—'} bold />
        </div>
      </GlassCard>

      <GlassCard className="mt-3">
        <div className="mb-3 font-heading text-base font-bold text-ink">Exports</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" loading={busy} onClick={() => exportCsv('rent-roll')}><Download size={16} /> Rent roll (CSV)</Button>
          <Button variant="ghost" loading={busy} onClick={() => exportCsv('arrears')}><Download size={16} /> Arrears aging (CSV)</Button>
          <Button variant="ghost" loading={busy} onClick={() => exportCsv('collection')}><Download size={16} /> Collection (CSV)</Button>
        </div>
      </GlassCard>
    </div>
  );
}

function Row({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className={bold ? 'font-semibold text-ink' : 'text-muted'}>{label}</span>
      <span className={`${bold ? 'font-heading font-bold text-brand' : danger ? 'text-danger' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
