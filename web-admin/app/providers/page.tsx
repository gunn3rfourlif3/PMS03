'use client';
import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Power } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState } from '@/components/ui';

const CATEGORIES = ['maintenance', 'landscaping', 'cleaning', 'plumbing', 'electrical', 'legal', 'security', 'other'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ProvidersPage() {
  const router = useRouter();
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
      <PageHeader title="Service providers" subtitle="Your approved contractors — maintenance, cleaning, legal, security and more" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">Add provider</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1"><Field label="Name"><input className="input" value={form.name ?? ''} onChange={(e) => setF('name', e.target.value)} placeholder="Sparkle Cleaners" /></Field></div>
          <div className="w-44"><Field label="Category">
            <select className="input" value={form.category} onChange={(e) => setF('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
            </select>
          </Field></div>
          <div className="w-40"><Field label="Contact"><input className="input" value={form.contactName ?? ''} onChange={(e) => setF('contactName', e.target.value)} /></Field></div>
          <div className="w-40"><Field label="Phone"><input className="input" value={form.phone ?? ''} onChange={(e) => setF('phone', e.target.value)} /></Field></div>
          <div className="w-52"><Field label="Email"><input className="input" value={form.email ?? ''} onChange={(e) => setF('email', e.target.value)} /></Field></div>
          <Button onClick={add} loading={busy} disabled={!form.name}><Plus size={16} /> Add</Button>
        </div>
      </GlassCard>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => onFilter(c)} className={`chip ${filter === c ? '' : 'chip-muted'}`}>{cap(c)}</button>
        ))}
        {filter && <button onClick={() => onFilter(filter)} className="chip chip-muted">Clear</button>}
      </div>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Category</th><th className="px-5 py-3 font-semibold">Contact</th><th className="px-5 py-3 font-semibold">Phone</th><th className="px-5 py-3 font-semibold">Email</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-white/40 hover:bg-white/30">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3"><Badge tone="brand">{cap(p.category)}</Badge></td>
                    <td className="px-5 py-3 text-muted">{p.contactName || '—'}</td>
                    <td className="px-5 py-3 text-muted">{p.phone || '—'}</td>
                    <td className="px-5 py-3 text-muted">{p.email || '—'}</td>
                    <td className="px-5 py-3"><Badge tone={p.status === 'active' ? 'success' : 'muted'}>{p.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => startEdit(p)}><Pencil size={15} /> Edit</Button>
                        <Button variant="ghost" onClick={() => toggle(p)}><Power size={15} /> {p.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                      </div>
                    </td>
                  </tr>
                  {editing === p.id && (
                    <tr className="bg-white/30"><td colSpan={7} className="px-5 py-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-44"><Field label="Name"><input className="input" value={edit.name ?? ''} onChange={(e) => setE('name', e.target.value)} /></Field></div>
                        <div className="w-40"><Field label="Category">
                          <select className="input" value={edit.category} onChange={(e) => setE('category', e.target.value)}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
                          </select>
                        </Field></div>
                        <div className="w-40"><Field label="Contact"><input className="input" value={edit.contactName ?? ''} onChange={(e) => setE('contactName', e.target.value)} /></Field></div>
                        <div className="w-36"><Field label="Phone"><input className="input" value={edit.phone ?? ''} onChange={(e) => setE('phone', e.target.value)} /></Field></div>
                        <div className="w-52"><Field label="Email"><input className="input" value={edit.email ?? ''} onChange={(e) => setE('email', e.target.value)} /></Field></div>
                        <Button onClick={() => saveEdit(p.id)} loading={busy}>Save</Button>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState>No providers yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
