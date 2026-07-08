'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, CheckCircle2 } from 'lucide-react';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Field, Button } from '@/components/ui';

const ACCOUNT_TYPES = ['cheque', 'savings', 'transmission'];

export default function PortalBanking() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<any>({ bankName: '', accountHolder: '', accountNumber: '', branchCode: '', accountType: 'cheque' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    if (!isOwner()) { router.replace('/'); return; }
    setReady(true);
    api.portalBanking().then((b) => b && setForm((f: any) => ({ ...f, ...b }))).catch((e) => setErr(e.message));
  }, []);

  const set = (k: string) => (e: any) => { setForm({ ...form, [k]: e.target.value }); setSaved(false); };

  const save = async () => {
    setErr(''); setBusy(true);
    try { await api.updatePortalBanking(form); setSaved(true); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Banking details" subtitle="Where we send your payouts" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      <GlassCard>
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
            <Landmark size={20} />
          </span>
          <div className="text-sm text-muted">Your details are used only to disburse rent collected on your behalf.</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank"><input className="input" value={form.bankName ?? ''} onChange={set('bankName')} placeholder="e.g. FNB" /></Field>
          <Field label="Account holder"><input className="input" value={form.accountHolder ?? ''} onChange={set('accountHolder')} /></Field>
          <Field label="Account number"><input className="input" value={form.accountNumber ?? ''} onChange={set('accountNumber')} /></Field>
          <Field label="Branch code"><input className="input" value={form.branchCode ?? ''} onChange={set('branchCode')} /></Field>
          <Field label="Account type">
            <select className="input" value={form.accountType ?? 'cheque'} onChange={set('accountType')}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} loading={busy}>Save banking details</Button>
          {saved && <span className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={16} /> Saved</span>}
        </div>
      </GlassCard>
    </div>
  );
}
