'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, CheckCircle2, X, ImagePlus } from 'lucide-react';
import { api, auth, thumbUrl } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, money } from '@/components/ui';

const AREAS = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'General'];
const CONDS = ['good', 'fair', 'poor', 'damaged'];
const total = (items: any[]) => (items ?? []).reduce((s, i) => s + Math.max(0, Number(i.deductionAmount) || 0), 0);

export default function InspectionsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [unitId, setUnitId] = useState('');
  const [type, setType] = useState('move_out');
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.units().then((u) => { setUnits(u); if (u[0]) setUnitId(u[0].id); }).catch((e) => setErr(e.message));
    load();
  }, []);

  const load = async () => { setErr(''); try { setRows(await api.listInspections()); } catch (e: any) { setErr(e.message); } };

  const create = async () => {
    if (!unitId) return;
    setBusy(true); setErr('');
    try { await api.createInspection({ unitId, type }); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const startEdit = (insp: any) => {
    setEditing(insp.id);
    setItems(insp.checklist?.length ? insp.checklist : AREAS.map((area) => ({ area, condition: 'good', deductionAmount: 0 })));
  };
  const setItem = (i: number, k: string, v: any) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const uploadItemPhoto = async (i: number, file?: File) => {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const { url } = await api.uploadMedia(file);
      setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, photos: [...(it.photos ?? []), url] } : it));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const removeItemPhoto = (i: number, url: string) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, photos: (it.photos ?? []).filter((u: string) => u !== url) } : it));
  const saveItems = async (id: string) => {
    setBusy(true); setErr('');
    try {
      const clean = items.map((i) => ({
        area: i.area, condition: i.condition,
        deductionAmount: Number(i.deductionAmount) || 0,
        photos: i.photos ?? [],
      }));
      await api.recordInspectionItems(id, clean); setEditing(null); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const signoff = async (id: string) => { setErr(''); try { await api.signoffInspection(id); await load(); } catch (e: any) { setErr(e.message); } };

  if (!ready) return null;
  const unitLabel = (id: string) => units.find((u) => u.id === id)?.label ?? id.slice(0, 8);

  return (
    <div>
      <PageHeader title="Inspections" subtitle="Move-in / move-out / periodic condition reports" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">New inspection</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Field label="Unit">
              <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                {units.length === 0 && <option value="">No units</option>}
                {units.map((u) => <option key={u.id} value={u.id}>{u.label} · {u.status}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-44">
            <Field label="Type">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="move_in">Move-in</option>
                <option value="move_out">Move-out</option>
                <option value="periodic">Periodic</option>
              </select>
            </Field>
          </div>
          <Button onClick={create} loading={busy} disabled={!unitId}><Plus size={16} /> Create</Button>
        </div>
      </GlassCard>

      {rows.map((insp) => (
        <GlassCard key={insp.id} className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-heading text-base font-bold">{unitLabel(insp.unitId)} · {String(insp.type).replace('_', '-')}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                <Badge tone={insp.status === 'signed_off' ? 'success' : insp.status === 'completed' ? 'brand' : 'muted'}>{insp.status}</Badge>
                {insp.conductedOn && <span>{insp.conductedOn}</span>}
                {total(insp.checklist) > 0 && <span className="text-danger">Deductions {money(total(insp.checklist))}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {insp.status !== 'signed_off' && <Button variant="ghost" onClick={() => startEdit(insp)}>Record items</Button>}
              {insp.status === 'completed' && <Button onClick={() => signoff(insp.id)}><CheckCircle2 size={15} /> Sign off</Button>}
            </div>
          </div>

          {editing === insp.id && (
            <div className="mt-4 border-t border-white/40 pt-4">
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="rounded-xl border border-white/40 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-28 text-sm">{it.area}</span>
                      <select className="input w-32" value={it.condition} onChange={(e) => setItem(i, 'condition', e.target.value)}>
                        {CONDS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input className="input w-32" placeholder="Deduction R" value={it.deductionAmount} onChange={(e) => setItem(i, 'deductionAmount', e.target.value)} />
                      <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/40 px-2.5 py-2 text-sm text-ink/70 hover:text-brand">
                        <ImagePlus size={15} /> Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadItemPhoto(i, e.target.files?.[0])} />
                      </label>
                    </div>
                    {(it.photos?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.photos.map((url: string) => (
                          <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/40">
                            <img src={thumbUrl(url)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = url; }} alt="" className="h-full w-full object-cover" />
                            <button onClick={() => removeItemPhoto(i, url)} title="Remove"
                              className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-danger">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => saveItems(insp.id)} loading={busy}><Save size={15} /> Save items</Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </GlassCard>
      ))}
      {rows.length === 0 && <GlassCard className="mt-4"><EmptyState>No inspections yet — create one above.</EmptyState></GlassCard>}
    </div>
  );
}
