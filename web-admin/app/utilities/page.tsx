'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Gauge, ChevronLeft, ChevronRight, X, Download, Scale } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';
import { gapsToCsv } from '@/lib/utility-gap-csv';

/**
 * Mirrors UtilityKind / METERED in src/modules/utilities.
 *
 * The English `label` is gone — the display name now comes from the catalogue,
 * keyed by `key`. `uom` stays as written: kWh, kL and m3 are unit symbols that
 * go to the API, not words to translate.
 */
const KINDS = [
  { key: 'electricity', uom: 'kWh', metered: true },
  { key: 'water', uom: 'kL', metered: true },
  { key: 'gas', uom: 'm3', metered: true },
  { key: 'sewerage', uom: 'fixed', metered: false },
  { key: 'refuse', uom: 'fixed', metered: false },
] as const;
const kindOf = (k: string) => KINDS.find((x) => x.key === k);
/** An unknown kind from the API renders as itself, not as a key name. */
const kindLabel = (t: TFunction, kind: string): string =>
  kindOf(kind) ? t(`utilities.kind.${kind}` as MessageKey) : kind;

const PAGE = 50;
const today = () => new Date().toISOString().slice(0, 10);

export default function UtilitiesPage() {
  const router = useRouter();
  const { t, money, number, date } = useLocale();
  const [ready, setReady] = useState(false);
  const [meters, setMeters] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [units, setUnits] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // new meter
  const [showNew, setShowNew] = useState(false);
  const [attachTo, setAttachTo] = useState<'unit' | 'property'>('unit');
  const [mUnitId, setMUnitId] = useState('');
  const [mPropertyId, setMPropertyId] = useState('');
  const [mKind, setMKind] = useState('electricity');
  const [mSerial, setMSerial] = useState('');
  const [mDigits, setMDigits] = useState('5');
  const [mMultiplier, setMMultiplier] = useState('1');

  // capture
  // recovery gap
  const [showGap, setShowGap] = useState(false);
  const [gap, setGap] = useState<any[]>([]);
  const [gapProperty, setGapProperty] = useState('');

  const [capture, setCapture] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [cDate, setCDate] = useState(today());
  const [cReading, setCReading] = useState('');
  const [cTariff, setCTariff] = useState('');
  const [cCost, setCCost] = useState('');
  const [cRollover, setCRollover] = useState(false);
  const [cEstimated, setCEstimated] = useState(false);
  const [cNote, setCNote] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.units().then(setUnits).catch(() => {});
    api.listProperties().then(setProperties).catch(() => {});
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, offset]);

  const load = async () => {
    setErr('');
    try {
      const r = await api.utilityMeters({ limit: PAGE, offset });
      setMeters(r.rows ?? []);
      setTotal(r.total ?? 0);
    } catch (e: any) { setErr(e.message); }
  };

  const unitLabel = (id?: string | null) => units.find((u) => u.id === id)?.label ?? '';
  const propName = (id?: string | null) => properties.find((p) => p.id === id)?.name ?? '';
  const where = (m: any) =>
    m.unitId ? unitLabel(m.unitId) : t('utilities.bulkSuffix', { property: propName(m.propertyId) });

  const createMeter = async () => {
    setBusy(true); setErr('');
    const k = kindOf(mKind)!;
    try {
      await api.createUtilityMeter({
        unitId: attachTo === 'unit' ? mUnitId : null,
        propertyId: attachTo === 'property' ? mPropertyId : null,
        kind: mKind,
        serial: mSerial || undefined,
        unitOfMeasure: k.uom,
        multiplier: Number(mMultiplier) || 1,
        dialDigits: k.metered ? Number(mDigits) || undefined : undefined,
      });
      setShowNew(false); setMSerial('');
      setOffset(0); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const loadGap = async () => {
    setErr('');
    try { setGap(await api.utilityRecoveryGap({ propertyId: gapProperty || undefined })); }
    catch (e: any) { setErr(e.message); }
  };

  const exportGap = () => {
    const blob = new Blob([gapsToCsv(gap)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-gap-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCapture = async (m: any) => {
    setCapture(m); setErr(''); setHistory([]);
    setCDate(today()); setCReading(''); setCTariff(''); setCCost('');
    setCRollover(false); setCEstimated(false); setCNote('');
    try { setHistory(await api.utilityReadings(m.id, 6)); } catch (e: any) { setErr(e.message); }
  };

  const previous = history[0];

  const submitReading = async () => {
    if (!capture) return;
    setBusy(true); setErr('');
    try {
      await api.captureUtilityReading({
        meterId: capture.id,
        readingDate: cDate,
        reading: capture.metered ? Number(cReading) : null,
        rollover: cRollover,
        estimated: cEstimated,
        tariffRate: cTariff === '' ? null : Number(cTariff),
        cost: cCost === '' ? null : Number(cCost),
        note: cNote || undefined,
      });
      // Reopen on the same meter so a clerk working down a building keeps going.
      await openCapture(capture);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('utilities.title')}
        subtitle={t('utilities.subtitle')}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setShowGap((v) => !v); if (!showGap) loadGap(); }}>
              <Scale size={16} /> {t('utilities.recoveryGap')}
            </Button>
            <Button onClick={() => setShowNew((v) => !v)}><Plus size={16} /> {t('utilities.addMeter')}</Button>
          </div>
        }
      />

      {err && <GlassCard className="border-danger/40 p-3 text-sm text-danger">{err}</GlassCard>}

      {showNew && (
        <GlassCard className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('utilities.field.attachedTo')}>
              <select value={attachTo} onChange={(e) => setAttachTo(e.target.value as any)} className="input">
                <option value="unit">{t('utilities.attach.unit')}</option>
                <option value="property">{t('utilities.attach.property')}</option>
              </select>
            </Field>
            {attachTo === 'unit' ? (
              <Field label={t('utilities.field.unit')}>
                <select value={mUnitId} onChange={(e) => setMUnitId(e.target.value)} className="input">
                  <option value="">{t('utilities.selectPlaceholder')}</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </Field>
            ) : (
              <Field label={t('utilities.field.property')}>
                <select value={mPropertyId} onChange={(e) => setMPropertyId(e.target.value)} className="input">
                  <option value="">{t('utilities.selectPlaceholder')}</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            <Field label={t('utilities.field.utility')}>
              <select value={mKind} onChange={(e) => setMKind(e.target.value)} className="input">
                {KINDS.map((k) => <option key={k.key} value={k.key}>{kindLabel(t, k.key)}</option>)}
              </select>
            </Field>
            <Field label={t('utilities.field.meterNumber')}>
              <input value={mSerial} onChange={(e) => setMSerial(e.target.value)} className="input" placeholder={t('utilities.field.meterNumberPlaceholder')} />
            </Field>
            {kindOf(mKind)?.metered && (
              <>
                <Field label={t('utilities.field.dialDigits')}>
                  <input value={mDigits} onChange={(e) => setMDigits(e.target.value)} className="input" inputMode="numeric" />
                </Field>
                <Field label={t('utilities.field.multiplier')}>
                  <input value={mMultiplier} onChange={(e) => setMMultiplier(e.target.value)} className="input" inputMode="decimal" />
                </Field>
              </>
            )}
          </div>
          <p className="text-xs text-muted">
            {t('utilities.dialDigitsHint')}
          </p>
          <div className="flex gap-2">
            <Button onClick={createMeter} disabled={busy || (attachTo === 'unit' ? !mUnitId : !mPropertyId)}>{t('utilities.saveMeter')}</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>{t('common.cancel')}</Button>
          </div>
        </GlassCard>
      )}

      {showGap && (
        <GlassCard className="space-y-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t('utilities.recoveryGap')}</h3>
              <p className="text-xs text-muted">
                {t('utilities.gapBlurb')}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <Field label={t('utilities.field.property')}>
                <select value={gapProperty} onChange={(e) => setGapProperty(e.target.value)} className="input">
                  <option value="">{t('utilities.gapAllProperties')}</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Button variant="ghost" onClick={loadGap}>{t('utilities.refresh')}</Button>
              <Button variant="ghost" onClick={exportGap} disabled={gap.length === 0}><Download size={16} /> {t('utilities.csv')}</Button>
            </div>
          </div>

          {gap.length === 0 ? (
            <EmptyState>{t('utilities.gapEmpty')}</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2">{t('utilities.gap.th.period')}</th>
                  <th className="py-2">{t('utilities.gap.th.property')}</th>
                  <th className="py-2">{t('utilities.gap.th.utility')}</th>
                  <th className="py-2 text-right">{t('utilities.gap.th.bulk')}</th>
                  <th className="py-2 text-right">{t('utilities.gap.th.submeters')}</th>
                  <th className="py-2 text-right">{t('utilities.gap.th.gap')}</th>
                  <th className="py-2 text-right">{t('utilities.gap.th.gapCost')}</th>
                </tr>
              </thead>
              <tbody>
                {gap.map((g, i) => (
                  <tr key={i} className="border-b border-line/50 last:border-0">
                    <td className="py-2">{g.period}</td>
                    <td className="py-2">{g.propertyName ?? t('common.none')}</td>
                    <td className="py-2">{kindLabel(t, g.kind)}</td>
                    <td className="py-2 text-right">{g.bulkConsumption ?? t('common.none')}</td>
                    <td className="py-2 text-right">
                      {g.subConsumption ?? t('common.none')}
                      {g.subMeters > 0 && <span className="ml-1 text-xs text-muted">({g.subMeters})</span>}
                    </td>
                    <td className="py-2 text-right">
                      {g.note
                        ? <span className="text-xs text-muted">{g.note}</span>
                        : <>{g.gapConsumption}{g.gapPct !== null && <span className="ml-1 text-xs text-muted">({g.gapPct}%)</span>}</>}
                    </td>
                    <td className="py-2 text-right">{g.gapCost != null ? money(g.gapCost) : t('common.none')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        {meters.length === 0 ? (
          <EmptyState>{t('utilities.noMeters')}</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">{t('utilities.th.where')}</th>
                <th className="px-4 py-3">{t('utilities.th.utility')}</th>
                <th className="px-4 py-3">{t('utilities.th.meterNo')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3">{where(m)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.metered ? 'brand' : 'muted'}>{kindLabel(t, m.kind)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{m.serial || t('common.none')}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => openCapture(m)}><Gauge size={16} /> {t('utilities.capture')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            {/* This duplicates components/pager.tsx. Translated in place
                rather than refactored — swapping in <Pager> is a behaviour
                change this day has no mandate for, but it should happen. */}
            <span className="text-muted">
              {t('pager.summary', { count: number(total, 0), noun: t('utilities.pagerNoun'), page, pages })}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                <ChevronLeft size={16} /> {t('pager.previous')}
              </Button>
              <Button variant="ghost" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>
                {t('pager.next')} <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      {capture && (
        <GlassCard className="space-y-4 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{where(capture)} — {kindLabel(t, capture.kind)}</h3>
              <p className="text-xs text-muted">
                {capture.serial ? `${t('utilities.meterPrefix', { serial: capture.serial })} ` : ''}
                {previous
                  ? t('utilities.previousReading', {
                      reading: previous.reading ?? t('common.none'),
                      date: date(previous.readingDate),
                    })
                  : t('utilities.noPreviousReading')}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setCapture(null)}><X size={16} /></Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('utilities.field.readingDate')}>
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="input" />
            </Field>
            {capture.metered && (
              <Field label={t('utilities.field.reading', { uom: capture.unitOfMeasure })}>
                <input value={cReading} onChange={(e) => setCReading(e.target.value)} className="input" inputMode="decimal" autoFocus />
              </Field>
            )}
            <Field label={t('utilities.field.tariff')}>
              <input value={cTariff} onChange={(e) => setCTariff(e.target.value)} className="input" inputMode="decimal" placeholder={t('utilities.optional')} />
            </Field>
            <Field label={t('utilities.field.cost')}>
              <input value={cCost} onChange={(e) => setCCost(e.target.value)} className="input" inputMode="decimal"
                placeholder={capture.metered ? t('utilities.costPlaceholderMetered') : t('utilities.costPlaceholderRequired')} />
            </Field>
          </div>

          {capture.metered && (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cRollover} onChange={(e) => setCRollover(e.target.checked)} />
                {t('utilities.rolledOver')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cEstimated} onChange={(e) => setCEstimated(e.target.checked)} />
                {t('utilities.estimatedNotRead')}
              </label>
            </div>
          )}

          <Field label={t('utilities.field.note')}>
            <input value={cNote} onChange={(e) => setCNote(e.target.value)} className="input" placeholder={t('utilities.optional')} />
          </Field>

          <Button onClick={submitReading} disabled={busy || (capture.metered && cReading === '')}>{t('utilities.saveReading')}</Button>

          {history.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">{t('utilities.recentReadings')}</p>
              <table className="w-full text-sm">
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2">{date(r.readingDate)}</td>
                      <td className="py-2">{r.reading ?? t('common.none')}</td>
                      <td className="py-2 text-muted">
                        {r.consumption === null || r.consumption === undefined
                          ? t('utilities.baseline')
                          : t('utilities.consumption', { amount: r.consumption, uom: capture.unitOfMeasure })}
                      </td>
                      <td className="py-2">{r.cost != null ? money(r.cost) : t('common.none')}</td>
                      <td className="py-2">
                        {r.estimated && <Badge tone="muted">{t('utilities.badge.estimated')}</Badge>}
                        {r.rollover && <Badge tone="danger">{t('utilities.badge.rollover')}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
