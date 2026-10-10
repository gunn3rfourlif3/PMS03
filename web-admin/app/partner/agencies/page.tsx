'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, UserPlus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, Modal, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const tierTone = (t: string): 'success' | 'brand' | 'muted' => (t === 'growth' ? 'success' : t === 'enterprise' ? 'brand' : 'muted');

/* Tier names are shared with /billing, so the same key set is reused — the two
   pages must not name the same plan differently. */
const TIERS = ['custom', 'starter', 'growth', 'scale', 'enterprise'] as const;
const tierLabel = (t: TFunction, tier: string): string =>
  (TIERS as readonly string[]).includes(tier) ? t(`billing.tier.${tier}` as MessageKey) : tier;
const blank = () => ({ agencyName: '', ownerName: '', ownerEmail: '', expectedUnits: '' });

export default function AgenciesPage() {
  const router = useRouter();
  const { t, money, date } = useLocale();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [ref, setRef] = useState<{ refCode: string; signupUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [a, r] = await Promise.all([api.partnerAgencies(), api.partnerReferral()]);
      setRows(a); setRef(r);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    // eslint-disable-next-line
  }, []);

  const copy = async () => {
    if (!ref) return;
    try { await navigator.clipboard.writeText(ref.signupUrl); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const add = async () => {
    if (!form.agencyName.trim() || !form.ownerEmail.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.onboardAgency({ agencyName: form.agencyName.trim(), ownerName: form.ownerName.trim(), ownerEmail: form.ownerEmail.trim(), expectedUnits: Number(form.expectedUnits) || 0 });
      setShowAdd(false); setForm(blank()); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('partner.agencies.title')} subtitle={t('partner.agencies.subtitle')} />
        <Button onClick={() => { setForm(blank()); setShowAdd(true); }}><UserPlus size={16} /> {t('partner.agencies.add')}</Button>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="mb-4">
        <div className="mb-1 font-heading text-base font-bold text-ink">{t('partner.agencies.referralLink')}</div>
        <p className="mb-3 text-sm text-muted">{t('partner.agencies.referralBlurb')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-sm">{ref?.signupUrl}</code>
          <Button variant="ghost" onClick={copy}>{copied ? <><Check size={14} /> {t('partner.agencies.copied')}</> : <><Copy size={14} /> {t('partner.agencies.copy')}</>}</Button>
        </div>
      </GlassCard>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-base font-bold text-ink">{t('partner.agencies.referred')}</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('partner.agencies.th.agency')}</th><th className="px-5 py-3 font-semibold">{t('partner.agencies.th.tier')}</th><th className="px-5 py-3 font-semibold">{t('partner.agencies.th.units')}</th><th className="px-5 py-3 font-semibold">{t('partner.agencies.th.mrr')}</th><th className="px-5 py-3 font-semibold">{t('partner.agencies.th.status')}</th><th className="px-5 py-3 font-semibold">{t('partner.agencies.th.joined')}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vendorId} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{r.agencyName}</td>
                  <td className="px-5 py-3"><Badge tone={tierTone(r.tier)}>{tierLabel(t, r.tier)}</Badge></td>
                  <td className="px-5 py-3">{r.unitCount}</td>
                  <td className="px-5 py-3">{money(r.mrr)}</td>
                  {/* The agency's subscription status comes straight from the
                      API and has no catalogue of its own on this page. */}
                  <td className="px-5 py-3 text-muted">{r.status}</td>
                  <td className="px-5 py-3 text-muted">{r.joinedAt ? date(r.joinedAt) : t('common.none')}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}><EmptyState>{t('partner.agencies.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('partner.agencies.addTitle')}
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button><Button onClick={add} loading={busy} disabled={!form.agencyName.trim() || !form.ownerEmail.trim()}>{t('partner.agencies.create')}</Button></>}>
        <p className="mb-4 text-sm text-muted">{t('partner.agencies.addBlurb')}</p>
        <div className="grid gap-3">
          <Field label={t('partner.agencies.field.agencyName')}><input className="input" value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} placeholder={t('partner.agencies.field.agencyNamePlaceholder')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('partner.agencies.field.ownerName')}><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></Field>
            <Field label={t('partner.agencies.field.ownerEmail')}><input className="input" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder={t('partner.agencies.field.ownerEmailPlaceholder')} /></Field>
          </div>
          <Field label={t('partner.agencies.field.expectedUnits')}><input className="input" inputMode="numeric" value={form.expectedUnits} onChange={(e) => setForm({ ...form, expectedUnits: e.target.value })} placeholder="25" /></Field>
        </div>
      </Modal>
    </div>
  );
}
