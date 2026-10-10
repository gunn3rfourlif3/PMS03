'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Check, X } from 'lucide-react';
import { api, auth, thumbUrl } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, BentoTile } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

/* `key` is the API's status filter ('' means all); `label` is the catalogue
   key. The two are separate because '' is not a message key. */
const FILTERS = [
  { key: 'pending', label: 'payments.filter.pending' },
  { key: '', label: 'payments.filter.all' },
  { key: 'accepted', label: 'payments.filter.accepted' },
  { key: 'rejected', label: 'payments.filter.rejected' },
] as const;
const tone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'accepted' ? 'success' : s === 'rejected' ? 'danger' : 'brand';
const isPdf = (u: string) => /\.pdf($|\?)/i.test(u || '');

/** A status the API sends that the catalogue does not know renders as itself,
 * not as `payments.status.whatever`. */
const KNOWN_STATUSES = ['pending', 'accepted', 'rejected'] as const;
const statusLabel = (t: TFunction, status: string): string =>
  (KNOWN_STATUSES as readonly string[]).includes(status)
    ? t(`payments.status.${status}` as MessageKey)
    : status;

export default function PaymentsPage() {
  const router = useRouter();
  // `money` comes from the locale, not from components/ui: the same amount has
  // to group its digits per the active language. ui.tsx's locale-unaware
  // export is converted on Day 5.
  const { t, money, date } = useLocale();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any>(null);
  const [reason, setReason] = useState('');

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); }, []);
  useEffect(() => { if (ready) load(); }, [ready, filter]);

  const load = async () => { setErr(''); try { setRows(await api.listProofs(filter)); } catch (e: any) { setErr(e.message); } };

  const accept = async (id: string) => {
    setBusy(id); setErr('');
    try { await api.acceptProof(id); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const doReject = async () => {
    if (!rejectFor) return;
    setBusy(rejectFor.id); setErr('');
    try { await api.rejectProof(rejectFor.id, reason); setRejectFor(null); setReason(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!ready) return null;
  const pending = rows.filter((r) => r.status === 'pending').length;
  const value = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div>
      <PageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <BentoTile tone="amber" value={String(pending)} label={t('payments.tile.awaiting')} />
        <BentoTile tone="teal" value={money(value)} label={t('payments.tile.value')} />
        <BentoTile tone="blue" value={String(rows.length)} label={t('payments.tile.submissions')} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${filter === f.key ? 'bg-ink text-white' : 'text-ink/70 hover:bg-black/5'}`}>
            {t(f.label)}
          </button>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid gap-4">
        {rows.map((p) => (
          <GlassCard key={p.id}>
            <div className="flex flex-wrap items-start gap-4">
              <button onClick={() => setPreview(p.fileUrl)} className="h-24 w-24 flex-none overflow-hidden rounded-xl border border-line bg-black/[0.03]">
                {isPdf(p.fileUrl)
                  ? <div className="grid h-full w-full place-items-center text-muted"><FileText size={26} /></div>
                  : <img src={thumbUrl(p.fileUrl)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = p.fileUrl; }} alt="" className="h-full w-full object-cover" />}
              </button>

              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-base font-bold text-ink">{p.tenantName ?? p.tenantEmail ?? t('payments.tenantFallback')}</span>
                  {/* The raw status was shown straight from the API; it is a
                      label on screen, so it goes through the catalogue. An
                      unknown status falls back to the raw value rather than
                      rendering a key name. */}
                  <Badge tone={tone(p.status)}>{statusLabel(t, p.status)}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {t('payments.invoiceLine', { period: p.invoicePeriod ?? '' })} · {money(p.invoiceTotal)} · <span className="text-ink/70">{p.invoiceStatus}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span>{t('payments.paid')}: <b className="text-ink">{p.amount ? money(p.amount) : t('common.none')}</b></span>
                  <span className="text-muted">{t('payments.paidAt')}: {p.paidAt ? date(p.paidAt) : t('common.none')}</span>
                  <span className="text-muted">{t('payments.reference')}: {p.reference ?? t('common.none')}</span>
                </div>
                {p.note && <p className="mt-1 text-sm text-ink/80">“{p.note}”</p>}
                {p.reviewNote && <p className="mt-1 text-sm text-danger">{t('payments.rejectedNote', { reason: p.reviewNote })}</p>}
              </div>

              {p.status === 'pending' && (
                <div className="flex gap-2">
                  <Button onClick={() => accept(p.id)} loading={busy === p.id}><Check size={15} /> {t('payments.accept')}</Button>
                  <Button variant="ghost" onClick={() => setRejectFor(p)}><X size={15} /> {t('payments.reject')}</Button>
                </div>
              )}
            </div>
          </GlassCard>
        ))}
        {rows.length === 0 && (
          <GlassCard>
            <EmptyState>
              {filter
                ? t('payments.emptyFiltered', { status: statusLabel(t, filter).toLocaleLowerCase() })
                : t('payments.empty')}
            </EmptyState>
          </GlassCard>
        )}
      </div>

      {/* Preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={t('payments.previewTitle')}
        footer={<>
          {preview && <a className="text-sm text-brand hover:underline" href={preview} target="_blank" rel="noreferrer">{t('payments.openOriginal')}</a>}
          <Button variant="ghost" onClick={() => setPreview(null)}>{t('common.close')}</Button>
        </>}>
        {preview && (isPdf(preview)
          ? <object data={preview} type="application/pdf" className="h-[70vh] w-full rounded-xl" />
          : <img src={preview} alt="" className="max-h-[70vh] w-full rounded-xl object-contain" />)}
      </Modal>

      {/* Reject */}
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title={t('payments.rejectTitle')}
        footer={<>
          <Button variant="ghost" onClick={() => setRejectFor(null)}>{t('common.cancel')}</Button>
          <Button onClick={doReject} loading={busy === rejectFor?.id}>{t('payments.rejectAndNotify')}</Button>
        </>}>
        <Field label={t('payments.reasonLabel')}>
          <textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('payments.reasonPlaceholder')} />
        </Field>
      </Modal>
    </div>
  );
}
