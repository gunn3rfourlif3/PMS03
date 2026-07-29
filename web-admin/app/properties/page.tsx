'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, BentoTile, money, ConfirmModal } from '@/components/ui';

type PendingDelete = { kind: 'property' | 'unit'; id: string; pid?: string; label: string };

const PTYPES = ['building', 'complex', 'single_unit', 'co_living'];
const USTATUS = ['vacant', 'occupied', 'maintenance', 'reserved', 'offline'];
const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const uTone = (s: string): 'success' | 'brand' | 'muted' | 'danger' =>
  s === 'occupied' ? 'success' : s === 'vacant' ? 'brand' : s === 'maintenance' ? 'danger' : 'muted';

export default function PropertiesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [props, setProps] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ type: 'building' });
  const [editProp, setEditProp] = useState<string | null>(null);
  const [pEdit, setPEdit] = useState<any>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [uForm, setUForm] = useState<any>({ status: 'vacant' });
  const [editUnit, setEditUnit] = useState<string | null>(null);
  const [uEdit, setUEdit] = useState<any>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    api.owners().then(setOwners).catch(() => {});
  }, []);

  const load = async () => { setErr(''); try { setProps(await api.listProperties()); } catch (e: any) { setErr(e.message); } };
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name;

  const setF = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const addProp = async () => {
    if (!form.name) return;
    setBusy(true); setErr('');
    try { await api.createProperty({ name: form.name, type: form.type, ownerId: form.ownerId || undefined }); setForm({ type: 'building' }); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const startEditProp = (p: any) => { setEditProp(p.id); setPEdit({ name: p.name, type: p.type, ownerId: p.owner_id ?? '' }); };
  const saveProp = async (id: string) => {
    setBusy(true); setErr('');
    try { await api.updateProperty(id, pEdit); setEditProp(null); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setErr(''); setDeleting(true);
    try {
      if (pendingDelete.kind === 'property') { await api.deleteProperty(pendingDelete.id); await load(); }
      else { await api.deleteUnit(pendingDelete.id); await reloadUnits(pendingDelete.pid!); await load(); }
      setPendingDelete(null);
    } catch (e: any) { setErr(e.message); } finally { setDeleting(false); }
  };

  const toggle = async (p: any) => {
    if (openId === p.id) { setOpenId(null); return; }
    setOpenId(p.id); setEditUnit(null); setUForm({ status: 'vacant' });
    try { setUnits(await api.unitsForProperty(p.id)); } catch (e: any) { setErr(e.message); }
  };
  const reloadUnits = async (pid: string) => { setUnits(await api.unitsForProperty(pid)); };
  const setUF = (k: string, v: string) => setUForm((f: any) => ({ ...f, [k]: v }));
  const addUnit = async (pid: string) => {
    if (!uForm.label) return;
    setBusy(true); setErr('');
    try {
      await api.createUnit(pid, { label: uForm.label, status: uForm.status, marketRent: Number(uForm.marketRent) || 0, bedrooms: Number(uForm.bedrooms) || 0, bathrooms: Number(uForm.bathrooms) || 0 });
      setUForm({ status: 'vacant' }); await reloadUnits(pid); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const startEditUnit = (u: any) => { setEditUnit(u.id); setUEdit({ label: u.label, status: u.status, marketRent: u.marketRent, bedrooms: u.bedrooms, bathrooms: u.bathrooms }); };
  const setUE = (k: string, v: string) => setUEdit((e: any) => ({ ...e, [k]: v }));
  const saveUnit = async (id: string, pid: string) => {
    setBusy(true); setErr('');
    try { await api.updateUnit(id, { label: uEdit.label, status: uEdit.status, marketRent: Number(uEdit.marketRent) || 0, bedrooms: Number(uEdit.bedrooms) || 0, bathrooms: Number(uEdit.bathrooms) || 0 }); setEditUnit(null); await reloadUnits(pid); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const totalUnits = props.reduce((s, p) => s + Number(p.unit_count || 0), 0);
  const occupied = props.reduce((s, p) => s + Number(p.occupied_count || 0), 0);
  const occRate = totalUnits ? Math.round((occupied / totalUnits) * 100) : 0;

  return (
    <div>
      <PageHeader title="Properties" subtitle="Manage your buildings and units" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="blue" value={String(props.length)} label="Properties" />
        <BentoTile tone="purple" value={String(totalUnits)} label="Units" />
        <BentoTile tone="teal" value={String(occupied)} label="Occupied" chip={`${occRate}%`} />
        <BentoTile tone="amber" value={String(totalUnits - occupied)} label="Vacant" />
      </div>

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">Add property</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1"><Field label="Name"><input className="input" value={form.name ?? ''} onChange={(e) => setF('name', e.target.value)} placeholder="Sandton Heights" /></Field></div>
          <div className="w-44"><Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setF('type', e.target.value)}>{PTYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
          </Field></div>
          <div className="w-52"><Field label="Owner (optional)">
            <select className="input" value={form.ownerId ?? ''} onChange={(e) => setF('ownerId', e.target.value)}>
              <option value="">— none —</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field></div>
          <Button onClick={addProp} loading={busy} disabled={!form.name}><Plus size={16} /> Add</Button>
        </div>
      </GlassCard>

      {props.map((p) => (
        <GlassCard key={p.id} className="mt-4">
          {editProp === p.id ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1"><Field label="Name"><input className="input" value={pEdit.name} onChange={(e) => setPEdit({ ...pEdit, name: e.target.value })} /></Field></div>
              <div className="w-40"><Field label="Type"><select className="input" value={pEdit.type} onChange={(e) => setPEdit({ ...pEdit, type: e.target.value })}>{PTYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field></div>
              <div className="w-52"><Field label="Owner"><select className="input" value={pEdit.ownerId} onChange={(e) => setPEdit({ ...pEdit, ownerId: e.target.value })}><option value="">— none —</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></div>
              <Button onClick={() => saveProp(p.id)} loading={busy}>Save</Button>
              <Button variant="ghost" onClick={() => setEditProp(null)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}><Building2 size={18} /></span>
                <div>
                  <div className="font-heading text-base font-bold">{p.name}</div>
                  <div className="mt-0.5 text-sm text-muted">{label(p.type)}{ownerName(p.owner_id) ? ` · ${ownerName(p.owner_id)}` : ''} · {p.occupied_count}/{p.unit_count} occupied</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => toggle(p)}>{openId === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Units</Button>
                <Button variant="ghost" onClick={() => startEditProp(p)}><Pencil size={15} /> Edit</Button>
                <Button variant="ghost" onClick={() => setPendingDelete({ kind: 'property', id: p.id, label: p.name })}><Trash2 size={15} /> Delete</Button>
              </div>
            </div>
          )}

          {openId === p.id && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <div className="w-28"><Field label="Unit label"><input className="input" value={uForm.label ?? ''} onChange={(e) => setUF('label', e.target.value)} placeholder="A-101" /></Field></div>
                <div className="w-36"><Field label="Status"><select className="input" value={uForm.status} onChange={(e) => setUF('status', e.target.value)}>{USTATUS.map((st) => <option key={st} value={st}>{label(st)}</option>)}</select></Field></div>
                <div className="w-28"><Field label="Rent"><input className="input" value={uForm.marketRent ?? ''} onChange={(e) => setUF('marketRent', e.target.value)} /></Field></div>
                <div className="w-20"><Field label="Beds"><input className="input" value={uForm.bedrooms ?? ''} onChange={(e) => setUF('bedrooms', e.target.value)} /></Field></div>
                <div className="w-20"><Field label="Baths"><input className="input" value={uForm.bathrooms ?? ''} onChange={(e) => setUF('bathrooms', e.target.value)} /></Field></div>
                <Button onClick={() => addUnit(p.id)} loading={busy} disabled={!uForm.label}><Plus size={15} /> Unit</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">Unit</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Rent</th><th className="py-2 pr-3 font-semibold">Beds/Baths</th><th className="py-2"></th>
                  </tr></thead>
                  <tbody>
                    {units.map((u) => editUnit === u.id ? (
                      <tr key={u.id} className="border-t border-line">
                        <td className="py-2 pr-3"><input className="input w-24" value={uEdit.label} onChange={(e) => setUE('label', e.target.value)} /></td>
                        <td className="py-2 pr-3"><select className="input w-32" value={uEdit.status} onChange={(e) => setUE('status', e.target.value)}>{USTATUS.map((st) => <option key={st} value={st}>{label(st)}</option>)}</select></td>
                        <td className="py-2 pr-3"><input className="input w-24" value={uEdit.marketRent} onChange={(e) => setUE('marketRent', e.target.value)} /></td>
                        <td className="py-2 pr-3"><div className="flex gap-1"><input className="input w-14" value={uEdit.bedrooms} onChange={(e) => setUE('bedrooms', e.target.value)} /><input className="input w-14" value={uEdit.bathrooms} onChange={(e) => setUE('bathrooms', e.target.value)} /></div></td>
                        <td className="py-2"><div className="flex gap-2"><Button onClick={() => saveUnit(u.id, p.id)} loading={busy}>Save</Button><Button variant="ghost" onClick={() => setEditUnit(null)}>Cancel</Button></div></td>
                      </tr>
                    ) : (
                      <tr key={u.id} className="border-t border-line hover:bg-black/[0.02]">
                        <td className="py-2 pr-3 font-medium">{u.label}</td>
                        <td className="py-2 pr-3"><Badge tone={uTone(u.status)}>{u.status}</Badge></td>
                        <td className="py-2 pr-3">{money(u.marketRent)}</td>
                        <td className="py-2 pr-3 text-muted">{u.bedrooms}bd / {u.bathrooms}ba</td>
                        <td className="py-2"><div className="flex gap-2"><Button variant="ghost" onClick={() => startEditUnit(u)}><Pencil size={14} /></Button><Button variant="ghost" onClick={() => setPendingDelete({ kind: 'unit', id: u.id, pid: p.id, label: u.label })}><Trash2 size={14} /></Button></div></td>
                      </tr>
                    ))}
                    {units.length === 0 && <tr><td colSpan={5}><EmptyState>No units yet — add one above.</EmptyState></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </GlassCard>
      ))}
      {props.length === 0 && <GlassCard className="mt-4"><EmptyState>No properties yet — add one above.</EmptyState></GlassCard>}

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        tone="danger"
        confirmLabel={pendingDelete?.kind === 'unit' ? 'Delete unit' : 'Delete property'}
        title={pendingDelete?.kind === 'unit' ? `Delete unit ${pendingDelete?.label}?` : `Delete ${pendingDelete?.label ?? 'this property'}?`}
        message={pendingDelete?.kind === 'unit'
          ? 'The unit will be removed. This is blocked if it has an active lease.'
          : 'The property will be removed. This is blocked if it still has units.'}
      />
    </div>
  );
}
