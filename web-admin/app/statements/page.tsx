'use client';
import { useState } from 'react';
import { Upload, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

/**
 * Bank-statement reconciliation.
 *
 * Two steps, and the gap between them is the point: preview reads and matches
 * but writes nothing, and only what a person has looked at gets recorded.
 *
 * The unmatched list is not an error state. A statement always has lines that
 * are not rent, and a reconciliation that matched everything would be the thing
 * to distrust.
 */
/* Was a Record of English strings. The codes stay; the wording moved to the
   catalogue. An unmatched code the API adds later renders as itself, exactly as
   the old `REASONS[u.reason] ?? u.reason` did. */
const REASON_CODES = [
  'not_a_credit', 'no_candidate', 'ambiguous_amount', 'invoice_already_matched',
] as const;
const reasonLabel = (t: TFunction, code: string): string =>
  (REASON_CODES as readonly string[]).includes(code)
    ? t(`statements.reason.${code}` as MessageKey)
    : code;

export default function StatementsPage() {
  const { t, tn, money, date } = useLocale();
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<any>(null);
  const [skip, setSkip] = useState<Record<string, boolean>>({});

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr(''); setDone(null); setSkip({});
    try { setPreview(await api.previewStatement(file)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const toRecord = (preview?.matched ?? []).filter((m: any) => !skip[m.lineId]);

  const commit = async () => {
    setBusy(true); setErr('');
    try {
      setDone(await api.commitStatement(
        toRecord.map((m: any) => ({ invoiceId: m.invoiceId, amount: m.amount, reference: m.reference })),
      ));
      setPreview(null);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('statements.title')}
        subtitle={t('statements.subtitle')}
      />

      {err && <GlassCard className="border-danger/40 p-3 text-sm text-danger">{err}</GlassCard>}

      {done && (
        <GlassCard className="p-4">
          <p className="text-sm text-ink">
            {tn('statements.recorded', Number(done.recorded) || 0)}
            {done.failed?.length > 0 && ` ${t('statements.someFailed', { count: done.failed.length })}`}
          </p>
          {done.failed?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-danger">
              {done.failed.map((f: any, i: number) => <li key={i}>{f.invoiceId}: {reasonLabel(t, f.reason)}</li>)}
            </ul>
          )}
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => upload(e.target.files?.[0])} />
          <span className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-onbrand shadow-soft"
            style={{ background: 'var(--brand)' }}>
            <Upload size={16} /> {t('statements.chooseFile')}
          </span>
          <span className="text-muted">
            {busy ? t('statements.reading') : t('statements.fileHint')}
          </span>
        </label>
      </GlassCard>

      {preview && (
        <>
          <GlassCard className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-ink">
                {t('statements.matchedCount', { matched: preview.summary.matched, lines: preview.summary.lines })}
                {preview.summary.matchedPct !== null && ` ${t('statements.matchedPct', { pct: preview.summary.matchedPct })}`}
              </span>
              <span className="text-muted">{t('statements.toRecord', { amount: money(preview.summary.matchedAmount) })}</span>
            </div>
            {Object.keys(preview.mapping ?? {}).length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {/* The column names are the bank's own header text, so they are
                    data and stay untranslated; only the sentence around them
                    moved to the catalogue. */}
                {t('statements.columnsRead', {
                  columns: Object.entries(preview.mapping).map(([k, v]) => `${k}: ${v}`).join(', '),
                })}{' '}
                {t('statements.dateWarning')}
              </p>
            )}
            {preview.skipped?.length > 0 && (
              <p className="mt-2 text-xs text-danger">
                {tn('statements.skippedRows', preview.skipped.length)}
                {' '}{preview.skipped.slice(0, 3).map((s: any) => t('statements.skippedRow', { row: s.row, reason: s.reason })).join(', ')}
                {preview.skipped.length > 3 ? '…' : ''}
              </p>
            )}
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              {t('statements.willBeRecorded')}
            </h2>
            {preview.matched.length === 0 ? (
              <EmptyState>{t('statements.nothingMatched')}</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {preview.matched.map((m: any) => (
                    <tr key={m.lineId} className={`border-b border-line/50 last:border-0 ${skip[m.lineId] ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2">{date(m.date)}</td>
                      <td className="px-4 py-2 text-muted">{m.description || m.reference || t('common.none')}</td>
                      <td className="px-4 py-2">{m.unit ?? t('common.none')} · {m.period}</td>
                      <td className="px-4 py-2">
                        <Badge tone={m.basis === 'reference' ? 'brand' : 'muted'}>
                          {m.basis === 'reference' ? t('statements.byReference') : t('statements.byAmount')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{money(m.amount)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" onClick={() => setSkip({ ...skip, [m.lineId]: !skip[m.lineId] })}>
                          {skip[m.lineId] ? t('statements.include') : t('statements.skip')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview.matched.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <Button onClick={commit} disabled={busy || toRecord.length === 0}>
                  <Check size={16} /> {tn('statements.recordButton', toRecord.length)}
                </Button>
              </div>
            )}
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              <AlertTriangle size={16} /> {t('statements.forYouToResolve')}
            </h2>
            {preview.unmatched.length === 0 ? (
              <EmptyState>{t('statements.everyLineMatched')}</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {preview.unmatched.map((u: any) => (
                    <tr key={u.lineId} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-2">{date(u.date)}</td>
                      <td className="px-4 py-2 text-muted">{u.description || t('common.none')}</td>
                      <td className="px-4 py-2 text-right">{money(u.amount)}</td>
                      <td className="px-4 py-2 text-muted">
                        {reasonLabel(t, u.reason)}
                        {u.candidates?.length > 1 && ` (${u.candidates.length})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="border-t border-line px-4 py-3 text-xs text-muted">
              {t('statements.notErrors')}
            </p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
