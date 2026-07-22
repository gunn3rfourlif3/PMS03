'use client';
import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, UserPlus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, money } from '@/components/ui';

export default function LeasesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [pct, setPct] = useState('8');
  const [months, setMonths] = useState('12');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Add-tenant modal state
  const [showAdd, setShowAdd] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [rent, setRent] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState('');

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);
  const load = async () => { setErr(''); try { setRows(await api.listLeases()); } catch (e: any) { setErr(e.message); } };

  const startRenew = (l: any) => { setEditing(l.id); setPct('8'); setMonths('12'); };
  const renew = async (id: string) => {
    setBusy(true); setErr('');
    try { await api.renewLease(id, Number(pct) || 0, Number(months) || 0); setEditing(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const openAdd = async () => {
    setName(''); setEmail(''); setPhone(''); setUnitId(''); setRent(''); setEnd('');
    setStart(new Date().toISOString().slice(0, 10)); setAddErr(''); setShowAdd(true);
    try { setUnits(await api.units()); } catch { /* dropdown just stays empty */ }
  };
  const pickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u && !rent && Number(u.marketRent) > 0) setRent(String(Math.round(Number(u.marketRent))));
  };
  const submitAdd = async () => {
    setAddBusy(true); setAddErr('');
    try {
      await api.addTenant({
        name, email, phone: phone || undefined, unitId,
        rentAmount: Number(rent) || 0, startDate: start, endDate: end || undefined,
      });
      setShowAdd(false); await load();
    } catch (e: any) { setAddErr(e.message); } finally { setAddBusy(false); }
  };

  if (!ready) return null;
  const projected = (r: number) => Math.round(Number(r) * (1 + (Number(pct) || 0) / 100));
  const canAdd = !!email && !!unitId && !!rent && !!start;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Leases" subtitle="Active leases — add tenants, renew and apply escalation" />
        <Button onClick={openAdd}><UserPlus size={16} /> Add tenant</Button>
      </div>
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
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState>No active leases. Use “Add tenant” to onboard your first tenant.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add tenant"
        footer={<>
          <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={addBusy}>Cancel</Button>
          <Button onClick={submitAdd} loading={addBusy} disabled={!canAdd}>Add tenant &amp; create lease</Button>
        </>}>
        {addErr && <div className="mb-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{addErr}</div>}
        <p className="mb-4 text-sm text-muted">Creates the tenant’s login account (they sign in with their email) and an active lease on the selected unit.</p>
        <div className="grid gap-3">
          <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Tenant" /></Field>
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" /></Field>
          <Field label="Phone (optional)"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 82 000 0000" /></Field>
          <Field label="Unit">
            <select className="input" value={unitId} onChange={(e) => pickUnit(e.target.value)}>
              <option value="">Select a unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.label}{u.status && u.status !== 'vacant' ? ` — ${u.status}` : ''}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly rent (R)"><input className="input" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="8500" /></Field>
            <Field label="Start date"><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          </div>
          <Field label="End date (optional)"><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
