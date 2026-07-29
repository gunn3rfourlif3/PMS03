'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, AlertTriangle, Wallet, RefreshCw, Play } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { Button, Field, EmptyState, money } from '@/components/ui';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const rate = collection ? Math.round(Number(collection.collectionRate)) : 0;
  const collected = collection ? Number(collection.collected) : 0;
  const billed = collection ? Number(collection.billed) : 0;
  const overdueUnits = rentRoll.filter((r) => Number(r.outstanding) > 0).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted">Portfolio overview — every figure scoped to your vendor</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-32"><Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field></div>
          <Button variant="ghost" onClick={load}><RefreshCw size={16} /> Refresh</Button>
          <Button onClick={runBilling} loading={busy}><Play size={16} /> Run billing</Button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {/* Hero — collected */}
        <div className="col-span-2 flex min-h-[168px] flex-col justify-between rounded-3xl p-6" style={{ background: '#AFA9EC' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#3C3489' }}>Collected · {period}</span>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#CECBF6', color: '#26215C' }}>{rate}% collected</span>
          </div>
          <div>
            <div className="font-heading text-4xl font-bold leading-none" style={{ color: '#26215C' }}>{money(collected)}</div>
            <div className="mt-1 text-sm" style={{ color: '#3C3489' }}>of {money(billed)} billed this period</div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#cfcbf2' }}>
            <div className="h-full rounded-full" style={{ width: `${rate}%`, background: '#534AB7' }} />
          </div>
        </div>

        {/* Donut — collection rate */}
        <div className="col-span-2 flex min-h-[168px] flex-col items-center justify-center rounded-3xl p-5 lg:col-span-1" style={{ background: '#9FE1CB' }}>
          <Donut value={rate} track="#c3ecdd" fill="#0F6E56" text="#04342C" sub="#0F6E56" />
          <span className="mt-2 text-xs font-medium" style={{ color: '#0F6E56' }}>collection rate</span>
        </div>

        {/* Arrears */}
        <Tile bg="#F5C4B3" icon={<AlertTriangle size={20} />} iconColor="#993C1D"
          value={money(arrears ? arrears.arrears : 0)} valueColor="#4A1B0C"
          label={`Arrears · ${overdueUnits} ${overdueUnits === 1 ? 'tenant' : 'tenants'}`} labelColor="#993C1D" />

        {/* Outstanding total */}
        <Tile bg="#FAC775" icon={<Wallet size={20} />} iconColor="#854F0B"
          value={money(arrears ? arrears.total : 0)} valueColor="#412402"
          label="Outstanding total" labelColor="#854F0B" />

        {/* Active leases */}
        <Tile className="col-span-2 lg:col-span-1" bg="#B5D4F4" icon={<Building2 size={20} />} iconColor="#185FA5"
          value={String(rentRoll.length)} valueColor="#042C53"
          label="Active leases" labelColor="#185FA5" />

        {/* Aging chart */}
        {arrears && (
          <div className="col-span-2 rounded-3xl border border-line bg-card p-5 lg:col-span-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-heading text-base font-bold text-ink">Outstanding by age</span>
              <span className="text-xs text-muted">reconciles to {money(arrears.total)}</span>
            </div>
            <AgingBars arrears={arrears} />
          </div>
        )}

        {/* Rent roll */}
        <div className="col-span-2 overflow-hidden rounded-3xl border border-line bg-card lg:col-span-3">
          <div className="px-5 pt-5 font-heading text-base font-bold text-ink">Rent roll</div>
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
                  <tr key={r.lease_id} className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3 font-medium text-ink">{r.unit}</td>
                    <td className="px-5 py-3">{money(r.rent_amount)}</td>
                    <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-5 py-3">
                      {Number(r.outstanding) > 0
                        ? <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#FAECE7', color: '#993C1D' }}>{money(r.outstanding)}</span>
                        : <span className="text-muted">{money(0)}</span>}
                    </td>
                  </tr>
                ))}
                {rentRoll.length === 0 && <tr><td colSpan={4}><EmptyState>No active leases.</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ bg, icon, iconColor, value, valueColor, label, labelColor, className = '' }: {
  bg: string; icon: React.ReactNode; iconColor: string; value: string; valueColor: string; label: string; labelColor: string; className?: string;
}) {
  return (
    <div className={`flex min-h-[104px] flex-col justify-between rounded-3xl p-5 ${className}`} style={{ background: bg }}>
      <span style={{ color: iconColor }}>{icon}</span>
      <div>
        <div className="font-heading text-2xl font-bold leading-none" style={{ color: valueColor }}>{value}</div>
        <div className="mt-1 text-xs font-medium" style={{ color: labelColor }}>{label}</div>
      </div>
    </div>
  );
}

function Donut({ value, track, fill, text, sub }: { value: number; track: string; fill: string; text: string; sub: string }) {
  const r = 42, c = 2 * Math.PI * r, dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative" style={{ width: 108, height: 108 }}>
      <svg width="108" height="108" viewBox="0 0 108 108">
        <circle cx="54" cy="54" r={r} fill="none" stroke={track} strokeWidth="12" />
        <circle cx="54" cy="54" r={r} fill="none" stroke={fill} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`} transform="rotate(-90 54 54)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-bold" style={{ color: text }}>{value}%</span>
        <span className="text-[11px]" style={{ color: sub }}>on time</span>
      </div>
    </div>
  );
}

function AgingBars({ arrears }: { arrears: any }) {
  const data = [
    { label: 'Not yet due', value: Number(arrears.notYetDue), color: '#7F77DD' },
    { label: '0–30', value: Number(arrears['0-30']), color: '#1D9E75' },
    { label: '31–60', value: Number(arrears['31-60']), color: '#EF9F27' },
    { label: '61–90', value: Number(arrears['61-90']), color: '#D85A30' },
    { label: '90+', value: Number(arrears['90+']), color: '#E24B4A' },
  ];
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 pt-3" style={{ height: 150 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[11px] font-semibold text-ink">{d.value > 0 ? money(d.value) : '—'}</span>
          <div className="w-full rounded-t-lg" style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color, minHeight: 4 }} />
          <span className="text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={active ? { background: '#E1F5EE', color: '#0F6E56' } : { background: '#F1EFE8', color: '#5F5E5A' }}>
      {status}
    </span>
  );
}
