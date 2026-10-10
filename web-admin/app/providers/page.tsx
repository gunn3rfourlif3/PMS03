'use client';
import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Power } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const CATEGORIES = ['maintenance', 'landscaping', 'cleaning', 'plumbing', 'electrical', 'legal', 'security', 'other'] as const;

/* Replaces a `cap()` helper that upper-cased the enum value's first letter.
   The values are unchanged and still what goes to the API; only the display
   moved to the catalogue. Unknown values render as themselves. */
const categoryLabel = (t: TFunction, c: string): string =>
  (CATEGORIES as readonly string[]).includes(c) ? t(`providers.category.${c}` as MessageKey) : c;
const statusLabel = (t: TFunction, st: string): string =>
  st === 'active' ? t('providers.status.active') : st === 'inactive' ? t('providers.status.inactive') : st;

export default function ProvidersPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<any>({ category: 'maintenance' });
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);
  const load = async (cat = filter) => { setErr(''); try { setRows(await api.listProviders(cat || undefined)); } catch (e: any) { setErr(e.message); } };
  const onFilter = (c: string) => { const nc = filter === c ? '' : c; setFilter(nc); load(nc); };

  const setF = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const add = async () => {
    if (!form.name) return;
    setBusy(true); setErr('');
    try { await api.createProvider(form); setForm({ category: 'maintenance' }); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const startEdit = (p: any) => { setEditing(p.id); setEdit({ ...p }); };
  const setE = (k: string, v: string) => setEdit((e: any) => ({ ...e, [k]: v }));
  const saveEdit = async (id: string) => {
    setBusy(true); setErr('');
    try { await api.updateProvider(id, { name: edit.name, category: edit.category, contactName: edit.contactName, phone: edit.phone, email: edit.email, notes: edit.notes }); setEditing(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const toggle = async (p: any) => { setErr(''); try { await api.setProviderStatus(p.id, p.status === 'active' ? 'inactive' : 'active'); await load(); } catch (e: any) { setErr(e.message); } };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title={t('providers.title')} subtitle={t('providers.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">{t('providers.add')}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1"><Field label={t('providers.field.name')}><input className="input" value={form.name ?? ''} onChange={(e) => setF('name', e.target.value)} placeholder={t('providers.field.namePlaceholder')} /></Field></div>
          <div className="w-44"><Field label={t('providers.field.category')}>
            <select className="input" value={form.category} onChange={(e) => setF('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
            </select>
          </Field></div>
          <div className="w-40"><Field label={t('providers.field.contact')}><input className="input" value={form.contactName ?? ''} onChange={(e) => setF('contactName', e.target.value)} /></Field></div>
          <div className="w-40"><Field label={t('providers.field.phone')}><input className="input" value={form.phone ?? ''} onChange={(e) => setF('phone', e.target.value)} /></Field></div>
          <div className="w-52"><Field label={t('providers.field.email')}><input className="input" value={form.email ?? ''} onChange={(e) => setF('email', e.target.value)} /></Field></div>
          <Button onClick={add} loading={busy} disabled={!form.name}><Plus size={16} /> {t('providers.addButton')}</Button>
        </div>
      </GlassCard>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => onFilter(c)} className={`chip ${filter === c ? '' : 'chip-muted'}`}>{categoryLabel(t, c)}</button>
        ))}
        {filter && <button onClick={() => onFilter(filter)} className="chip chip-muted">{t('providers.clearFilter')}</button>}
      </div>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('providers.th.name')}</th><th className="px-5 py-3 font-semibold">{t('providers.th.category')}</th><th className="px-5 py-3 font-semibold">{t('providers.th.contact')}</th><th className="px-5 py-3 font-semibold">{t('providers.th.phone')}</th><th className="px-5 py-3 font-semibold">{t('providers.th.email')}</th><th className="px-5 py-3 font-semibold">{t('providers.th.status')}</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3"><Badge tone="brand">{categoryLabel(t, p.category)}</Badge></td>
                    <td className="px-5 py-3 text-muted">{p.contactName || t('common.none')}</td>
                    <td className="px-5 py-3 text-muted">{p.phone || t('common.none')}</td>
                    <td className="px-5 py-3 text-muted">{p.email || t('common.none')}</td>
                    <td className="px-5 py-3"><Badge tone={p.status === 'active' ? 'success' : 'muted'}>{statusLabel(t, p.status)}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => startEdit(p)}><Pencil size={15} /> {t('providers.edit')}</Button>
                        <Button variant="ghost" onClick={() => toggle(p)}><Power size={15} /> {p.status === 'active' ? t('providers.deactivate') : t('providers.activate')}</Button>
                      </div>
                    </td>
                  </tr>
                  {editing === p.id && (
                    <tr className="bg-black/[0.03]"><td colSpan={7} className="px-5 py-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-44"><Field label={t('providers.field.name')}><input className="input" value={edit.name ?? ''} onChange={(e) => setE('name', e.target.value)} /></Field></div>
                        <div className="w-40"><Field label={t('providers.field.category')}>
                          <select className="input" value={edit.category} onChange={(e) => setE('category', e.target.value)}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
                          </select>
                        </Field></div>
                        <div className="w-40"><Field label={t('providers.field.contact')}><input className="input" value={edit.contactName ?? ''} onChange={(e) => setE('contactName', e.target.value)} /></Field></div>
                        <div className="w-36"><Field label={t('providers.field.phone')}><input className="input" value={edit.phone ?? ''} onChange={(e) => setE('phone', e.target.value)} /></Field></div>
                        <div className="w-52"><Field label={t('providers.field.email')}><input className="input" value={edit.email ?? ''} onChange={(e) => setE('email', e.target.value)} /></Field></div>
                        <Button onClick={() => saveEdit(p.id)} loading={busy}>{t('common.save')}</Button>
                        <Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState>{t('providers.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
