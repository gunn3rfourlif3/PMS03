'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Percent, Receipt, TrendingUp, Download } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Metric, Button, Field, money } from '@/components/ui';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

/** Turn an array of flat objects into a CSV file and trigger a download. */
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

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);

  const load = async () => {
    setErr('');
    try {
      const [inc, col] = await Promise.all([api.income(period), api.collection(period)]);
      setIncome(inc); setCollection(col);
    } catch (e: any) { setErr(e.message); }
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

  return (
    <div>
      <PageHeader title="Reports" subtitle="Period income statement and data exports"
        action={<div className="flex items-end gap-2">
          <div className="w-32"><Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field></div>
          <Button onClick={load}>Run</Button>
        </div>} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Rent collected" value={income ? money(income.rentCollected) : '—'} icon={<Banknote size={18} />} />
        <Metric label="Management fees" value={income ? money(income.managementFees) : '—'} icon={<Percent size={18} />} />
        <Metric label="Expenses" value={income ? money(income.expenses) : '—'} tone="danger" icon={<Receipt size={18} />} />
        <Metric label="Net operating" value={income ? money(income.netOperating) : '—'} accent icon={<TrendingUp size={18} />} />
      </div>

      <GlassCard className="mt-4">
        <div className="mb-1 font-heading text-lg font-bold">Income statement · {period}</div>
        <p className="mb-4 text-sm text-muted">Cash basis — rent actually collected in the period, plus management-fee income, less expenses incurred.</p>
        <div className="divide-y divide-white/40 text-sm">
          <Row label="Rent collected" value={income ? money(income.rentCollected) : '—'} />
          <Row label="Management fee income" value={income ? money(income.managementFees) : '—'} />
          <Row label="Expenses" value={income ? `(${money(income.expenses)})` : '—'} danger />
          <Row label="Net operating income" value={income ? money(income.netOperating) : '—'} bold />
          <Row label={`Collection rate · ${period}`} value={collection ? `${collection.collectionRate}%` : '—'} />
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="mb-3 font-heading text-lg font-bold">Exports</div>
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
