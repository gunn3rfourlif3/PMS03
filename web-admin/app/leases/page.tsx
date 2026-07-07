'use client';
import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, money } from '@/components/ui';

export default function LeasesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [pct, setPct] = useState('8');
  const [months, setMonths] = useState('12');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);
  const load = async () => { setErr(''); try { setRows(await api.listLeases()); } catch (e: any) { setErr(e.message); } };

  const startRenew = (l: any) => { setEditing(l.id); setPct('8'); setMonths('12'); };
  const renew = async (id: string) => {
    setBusy(true); setErr('');
    try { await api.renewLease(id, Number(pct) || 0, Number(months) || 0); setEditing(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const projected = (rent: number) => Math.round(Number(rent) * (1 + (Number(pct) || 0) / 100));

  return (
    <div>
      <PageHeader title="Leases" subtitle="Active leases — renew and apply escalation" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Unit</th><th className="px-5 py-3 font-semibold">Rent</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Start</th><th className="px-5 py-3 font-semibold">End</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((l) => (
                <Fragment key={l.id}>
                  <tr className="border-t border-white/40 hover:bg-white/30">
                    <td className="px-5 py-3 font-medium">{l.unit}</td>
                    <td className="px-5 py-3">{money(l.rent_amount)}</td>
                    <td className="px-5 py-3 text-muted">{l.type}</td>
                    <td className="px-5 py-3 text-muted">{l.start_date}</td>
                    <td className="px-5 py-3 text-muted">{l.end_date || '—'}</td>
                    <td className="px-5 py-3"><Badge tone="success">{l.status}</Badge></td>
                    <td className="px-5 py-3"><Button variant="ghost" onClick={() => startRenew(l)}><CalendarClock size={15} /> Renew</Button></td>
                  </tr>
                  {editing === l.id && (
                    <tr className="bg-white/30">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-32"><Field label="Escalation %"><input className="input" value={pct} onChange={(e) => setPct(e.target.value)} /></Field></div>
                          <div className="w-32"><Field label="Extend (months)"><input className="input" value={months} onChange={(e) => setMonths(e.target.value)} /></Field></div>
                          <div className="text-sm text-muted">New rent: <span className="font-semibold text-ink">{money(projected(l.rent_amount))}</span></div>
                          <Button onClick={() => renew(l.id)} loading={busy}>Apply renewal</Button>
                          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState>No active leases.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
