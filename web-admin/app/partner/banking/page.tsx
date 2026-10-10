'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey } from '@shared/i18n';

/* `key` is the banking field name sent to the API; the label is derived from
   it (`partner.banking.field.<key>`) rather than carried alongside. */
const FIELDS = ['bankName', 'accountHolder', 'accountNumber', 'branchCode', 'accountType'] as const;

export default function PartnerBankingPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [bank, setBank] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.partnerBanking().then(setBank).catch((e) => setErr(e.message));
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    setBusy(true); setErr(''); setSaved(false);
    try { const updated = await api.updatePartnerBanking(bank); setBank(updated); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title={t('partner.banking.title')} subtitle={t('partner.banking.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="max-w-xl">
        <div className="grid gap-3">
          {FIELDS.map((k) => (
            <Field key={k} label={t(`partner.banking.field.${k}` as MessageKey)}>
              <input className="input" value={bank[k] ?? ''} onChange={(e) => setBank({ ...bank, [k]: e.target.value })}
                placeholder={k === 'accountNumber' && bank.accountNumberLast4 ? `•••• ${bank.accountNumberLast4}` : ''} />
            </Field>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} loading={busy}>{t('partner.banking.save')}</Button>
            {saved && <span className="text-sm text-success">{t('partner.banking.saved')}</span>}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
