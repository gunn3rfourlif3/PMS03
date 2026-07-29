'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, ConfirmModal } from '@/components/ui';

const SCOPES = ['read', 'write'];
const statusOf = (k: any): { label: string; tone: 'success' | 'danger' | 'muted' } => {
  if (k.revokedAt) return { label: 'revoked', tone: 'danger' };
  if (k.expiresAt && new Date(k.expiresAt) < new Date()) return { label: 'expired', tone: 'muted' };
  return { label: 'active', tone: 'success' };
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [created, setCreated] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);
  const load = async () => { setErr(''); try { setKeys(await api.listApiKeys()); } catch (e: any) { setErr(e.message); } };

  const toggleScope = (sc: string) => setScopes(scopes.includes(sc) ? scopes.filter((x) => x !== sc) : [...scopes, sc]);
  const create = async () => {
    if (!name) return;
    setBusy(true); setErr(''); setCreated(null);
    try { const r = await api.createApiKey(name, scopes); setCreated(r); setName(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!revokeId) return;
    setErr(''); setRevoking(true);
    try { await api.revokeApiKey(revokeId); setRevokeId(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setRevoking(false); }
  };
  const copy = (v: string) => navigator.clipboard?.writeText(v);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="API keys" subtitle="Programmatic access to your vendor data" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {created && (
        <GlassCard className="mb-4" style={{ borderColor: 'var(--brand)' } as any}>
          <div className="font-heading font-bold text-brand">Copy your new key now — it won’t be shown again.</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-black/[0.04] px-3 py-2 text-sm">{created.apiKey}</code>
            <Button variant="ghost" onClick={() => copy(created.apiKey)}><Copy size={15} /> Copy</Button>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">Create key</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1"><Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier integration" /></Field></div>
          <div>
            <span className="field-label">Scopes</span>
            <div className="flex gap-2">
              {SCOPES.map((sc) => (
                <button key={sc} onClick={() => toggleScope(sc)} type="button"
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${scopes.includes(sc) ? 'chip' : 'chip-muted chip'}`}>
                  {sc}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={create} loading={busy} disabled={!name}><Plus size={16} /> Create</Button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-lg font-bold">Keys</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Prefix</th><th className="px-5 py-3 font-semibold">Scopes</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Created</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {keys.map((k) => {
                const st = statusOf(k);
                return (
                  <tr key={k.id} className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3 font-medium">{k.name}</td>
                    <td className="px-5 py-3"><code className="text-xs">{k.prefix}…</code></td>
                    <td className="px-5 py-3 text-muted">{(k.scopes ?? []).join(', ') || '—'}</td>
                    <td className="px-5 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="px-5 py-3 text-muted">{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3">{!k.revokedAt && <Button variant="ghost" onClick={() => setRevokeId(k.id)}><Trash2 size={15} /> Revoke</Button>}</td>
                  </tr>
                );
              })}
              {keys.length === 0 && <tr><td colSpan={6}><EmptyState>No API keys yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <ConfirmModal
        open={!!revokeId}
        onClose={() => setRevokeId(null)}
        onConfirm={revoke}
        loading={revoking}
        tone="danger"
        confirmLabel="Revoke key"
        title="Revoke this key?"
        message="Apps using it will stop working immediately. This can't be undone."
      />
    </div>
  );
}
