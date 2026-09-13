'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, KeyRound, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, Button, Badge, PageHeader, EmptyState, Field } from '@/components/ui';

/**
 * Who can reach the back office (gap R-2).
 *
 * Granting used to mean editing .env.prod and recreating the API container —
 * and so did revoking, which is the half that mattered: an operator who left
 * kept their access until someone SSH'd into the box.
 */

type Grant = {
  id: string; userId: string; email: string; name?: string | null; note?: string | null;
  grantedBy?: string | null; grantedAt: string;
  revokedBy?: string | null; revokedAt?: string | null;
};

const fmt = (s?: string | null) =>
  (s ? new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const input = 'w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand';

export default function AdminOperatorsPage() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [bootstrap, setBootstrap] = useState<string[]>([]);
  const [me, setMe] = useState('');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ email: '', name: '', note: '' });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = () => {
    api.operators()
      .then((r) => { setGrants(r.grants ?? []); setBootstrap(r.bootstrap ?? []); setMe(r.me ?? ''); })
      .catch((e) => { setErr(e.message); setGrants([]); });
  };
  useEffect(load, []);

  const active = (grants ?? []).filter((g) => !g.revokedAt);
  const past = (grants ?? []).filter((g) => g.revokedAt);

  const grant = async () => {
    setBusy('grant'); setErr(''); setOk('');
    try {
      const r = await api.grantOperator(f);
      setGrants(r.grants ?? []);
      setOk(`${r.email} can sign in as an operator. It takes effect the next time they sign in.`);
      setF({ email: '', name: '', note: '' });
      setAdding(false);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(''); }
  };

  const revoke = async (g: Grant) => {
    if (!window.confirm(
      `Remove ${g.email}'s access to the back office?\n\n`
      + 'They are signed out of every device immediately.',
    )) return;
    setBusy(g.id); setErr(''); setOk('');
    try {
      const r = await api.revokeOperator(g.id);
      setGrants(r.grants ?? []);
      setOk(`${r.email} no longer has access${r.sessionsEnded ? `, and was signed out of ${r.sessionsEnded} session${r.sessionsEnded === 1 ? '' : 's'}` : ''}.`);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(''); }
  };

  return (
    <div>
      <PageHeader
        title="Operators"
        subtitle="Who can reach the Locare back office. Removing access signs them out immediately."
      />

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {ok && (
        <div className="mb-4 rounded-xl px-3 py-2 text-sm text-success"
          style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
          {ok}
        </div>
      )}

      {!adding && (
        <div className="mb-4">
          <Button onClick={() => { setAdding(true); setOk(''); }}><Plus size={14} /> Grant access</Button>
        </div>
      )}

      {adding && (
        <GlassCard className="mb-4">
          <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-ink">
            <ShieldCheck size={18} /> Grant operator access
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email address">
              <input className={input} value={f.email} spellCheck={false} autoFocus
                onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))}
                placeholder="sam@locare.co.za" />
            </Field>
            <Field label="Name (optional)">
              <input className={input} value={f.name}
                onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
                placeholder="Sam Nkosi" />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Why they need it">
              <input className={input} value={f.note}
                onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
                placeholder="Onboarding operator — runs stages 1 to 5" />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={grant} loading={busy === 'grant'} disabled={!f.email.trim() || !f.note.trim()}>
              Grant access
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={!!busy}>Cancel</Button>
            <span className="text-xs text-muted">
              They do not need an account yet — one is created, and they sign in with a one-time code.
            </span>
          </div>
        </GlassCard>
      )}

      {grants === null ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {bootstrap.length > 0 && (
            <GlassCard className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <KeyRound size={15} /> Bootstrap admins
              </div>
              <p className="mb-3 text-xs text-muted">
                Set in the server environment, not granted here. They are the way back in if the last
                grant is ever removed by accident — which is why they cannot be revoked from this
                screen. Changing them means editing <span className="text-ink">.env.prod</span> and
                redeploying.
              </p>
              <div className="flex flex-wrap gap-2">
                {bootstrap.map((e) => <Badge key={e} tone="muted">{e}</Badge>)}
              </div>
            </GlassCard>
          )}

          <h2 className="mb-3 font-heading text-lg font-bold text-ink">Active ({active.length})</h2>
          {active.length === 0 ? (
            <EmptyState>No granted operators — only the bootstrap admins above can sign in.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {active.map((g) => (
                <GlassCard key={g.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-heading text-base font-bold text-ink">
                      {g.name || g.email}
                      {g.email === me && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </div>
                    <div className="text-sm text-muted">{g.email}</div>
                    {g.note && <div className="mt-1 text-sm text-ink">{g.note}</div>}
                    <div className="mt-1 text-xs text-muted">
                      Granted {fmt(g.grantedAt)}{g.grantedBy ? ` by ${g.grantedBy}` : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => revoke(g)}
                    loading={busy === g.id}
                    disabled={g.email === me || active.length <= 1}
                    title={
                      g.email === me ? 'You cannot remove your own access — ask another admin.'
                        : active.length <= 1 ? 'This is the last granted operator.' : undefined
                    }
                  >
                    <ShieldOff size={14} /> Remove access
                  </Button>
                </GlassCard>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 font-heading text-lg font-bold text-ink">Previously ({past.length})</h2>
              <GlassCard className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3">Operator</th>
                      <th className="px-4 py-3">Reason given</th>
                      <th className="px-4 py-3">Granted</th>
                      <th className="px-4 py-3">Removed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((g) => (
                      <tr key={g.id} className="border-b border-line/60">
                        <td className="px-4 py-3">{g.email}</td>
                        <td className="px-4 py-3 text-muted">{g.note || '—'}</td>
                        <td className="px-4 py-3 text-muted">{fmt(g.grantedAt)}{g.grantedBy ? ` · ${g.grantedBy}` : ''}</td>
                        <td className="px-4 py-3 text-muted">{fmt(g.revokedAt)}{g.revokedBy ? ` · ${g.revokedBy}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            </>
          )}
        </>
      )}
    </div>
  );
}
