'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, CheckCircle2 } from 'lucide-react';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Field, Button } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const ACCOUNT_TYPES = ['cheque', 'savings', 'transmission'] as const;
/* Replaces `t[0].toUpperCase() + t.slice(1)`, which cannot translate. */
const accountTypeLabel = (t: TFunction, v: string): string =>
  (ACCOUNT_TYPES as readonly string[]).includes(v) ? t(`portal.banking.accountType.${v}` as MessageKey) : v;

export default function PortalBanking() {
  const router = useRouter();
  const { t } = useLocale();
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
      <PageHeader title={t('portal.banking.title')} subtitle={t('portal.banking.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      <GlassCard>
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
            <Landmark size={20} />
          </span>
          <div className="text-sm text-muted">{t('portal.banking.blurb')}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('portal.banking.field.bank')}><input className="input" value={form.bankName ?? ''} onChange={set('bankName')} placeholder={t('portal.banking.field.bankPlaceholder')} /></Field>
          <Field label={t('portal.banking.field.accountHolder')}><input className="input" value={form.accountHolder ?? ''} onChange={set('accountHolder')} /></Field>
          <Field label={t('portal.banking.field.accountNumber')}><input className="input" value={form.accountNumber ?? ''} onChange={set('accountNumber')} /></Field>
          <Field label={t('portal.banking.field.branchCode')}><input className="input" value={form.branchCode ?? ''} onChange={set('branchCode')} /></Field>
          <Field label={t('portal.banking.field.accountType')}>
            {/* `at`, not `t`: the map parameter would shadow the translator. */}
            <select className="input" value={form.accountType ?? 'cheque'} onChange={set('accountType')}>
              {ACCOUNT_TYPES.map((at) => <option key={at} value={at}>{accountTypeLabel(t, at)}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} loading={busy}>{t('portal.banking.save')}</Button>
          {saved && <span className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={16} /> {t('portal.banking.saved')}</span>}
        </div>
      </GlassCard>
    </div>
  );
}
