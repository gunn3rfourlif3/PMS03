'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, CheckCircle2, X, ImagePlus } from 'lucide-react';
import { api, auth, thumbUrl } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

/**
 * The default checklist areas.
 *
 * These stay ENGLISH because they are DATA: `startEdit` seeds the checklist
 * with them and `saveItems` posts `area` to the API, where it is stored on the
 * inspection record. Translating the array would write Chinese into the
 * database and make an inspection's own history depend on the language the
 * clerk happened to have selected. Only the DISPLAY is translated, below.
 */
const AREAS = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'General'] as const;
const AREA_KEYS: Record<string, MessageKey> = {
  Kitchen: 'inspections.area.kitchen',
  Bathroom: 'inspections.area.bathroom',
  Bedroom: 'inspections.area.bedroom',
  'Living room': 'inspections.area.livingRoom',
  General: 'inspections.area.general',
};
/** A stored area with no key — an older record, or free text someone typed —
 * renders its own stored value rather than a key name. */
const areaLabel = (t: TFunction, area: string): string =>
  AREA_KEYS[area] ? t(AREA_KEYS[area]) : area;

const CONDS = ['good', 'fair', 'poor', 'damaged'] as const;
const conditionLabel = (t: TFunction, c: string): string =>
  (CONDS as readonly string[]).includes(c) ? t(`inspections.condition.${c}` as MessageKey) : c;

const TYPES = ['move_in', 'move_out', 'periodic'] as const;
const typeLabel = (t: TFunction, ty: string): string =>
  (TYPES as readonly string[]).includes(ty) ? t(`inspections.type.${ty}` as MessageKey) : String(ty).replace('_', '-');

const STATUSES = ['open', 'completed', 'signed_off'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`inspections.status.${st}` as MessageKey) : st;
const total = (items: any[]) => (items ?? []).reduce((s, i) => s + Math.max(0, Number(i.deductionAmount) || 0), 0);

export default function InspectionsPage() {
  const router = useRouter();
  const { t, money, date } = useLocale();
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
      <PageHeader title={t('inspections.title')} subtitle={t('inspections.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">{t('inspections.new')}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Field label={t('inspections.field.unit')}>
              <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                {units.length === 0 && <option value="">{t('inspections.noUnits')}</option>}
                {units.map((u) => <option key={u.id} value={u.id}>{u.label} · {u.status}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-44">
            <Field label={t('inspections.field.type')}>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(t, ty)}</option>)}
              </select>
            </Field>
          </div>
          <Button onClick={create} loading={busy} disabled={!unitId}><Plus size={16} /> {t('inspections.create')}</Button>
        </div>
      </GlassCard>

      {rows.map((insp) => (
        <GlassCard key={insp.id} className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-heading text-base font-bold">{unitLabel(insp.unitId)} · {typeLabel(t, insp.type)}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                <Badge tone={insp.status === 'signed_off' ? 'success' : insp.status === 'completed' ? 'brand' : 'muted'}>{statusLabel(t, insp.status)}</Badge>
                {insp.conductedOn && <span>{date(insp.conductedOn)}</span>}
                {total(insp.checklist) > 0 && <span className="text-danger">{t('inspections.deductions', { amount: money(total(insp.checklist)) })}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {insp.status !== 'signed_off' && <Button variant="ghost" onClick={() => startEdit(insp)}>{t('inspections.recordItems')}</Button>}
              {insp.status === 'completed' && <Button onClick={() => signoff(insp.id)}><CheckCircle2 size={15} /> {t('inspections.signOff')}</Button>}
            </div>
          </div>

          {editing === insp.id && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="rounded-xl border border-line p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-28 text-sm">{areaLabel(t, it.area)}</span>
                      <select className="input w-32" value={it.condition} onChange={(e) => setItem(i, 'condition', e.target.value)}>
                        {CONDS.map((c) => <option key={c} value={c}>{conditionLabel(t, c)}</option>)}
                      </select>
                      <input className="input w-32" placeholder={t('inspections.deductionPlaceholder')} value={it.deductionAmount} onChange={(e) => setItem(i, 'deductionAmount', e.target.value)} />
                      <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-line px-2.5 py-2 text-sm text-ink/70 hover:text-brand">
                        <ImagePlus size={15} /> {t('inspections.photo')}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadItemPhoto(i, e.target.files?.[0])} />
                      </label>
                    </div>
                    {(it.photos?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.photos.map((url: string) => (
                          <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-line">
                            <img src={thumbUrl(url)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = url; }} alt="" className="h-full w-full object-cover" />
                            <button onClick={() => removeItemPhoto(i, url)} title={t('inspections.removePhoto')}
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
                <Button onClick={() => saveItems(insp.id)} loading={busy}><Save size={15} /> {t('inspections.saveItems')}</Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              </div>
            </div>
          )}
        </GlassCard>
      ))}
      {rows.length === 0 && <GlassCard className="mt-4"><EmptyState>{t('inspections.empty')}</EmptyState></GlassCard>}
    </div>
  );
}
