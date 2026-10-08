'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Gauge, ChevronLeft, ChevronRight, X, Download, Scale } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, money } from '@/components/ui';
import { gapsToCsv } from '@/lib/utility-gap-csv';

/** Mirrors UtilityKind / METERED in src/modules/utilities. */
const KINDS = [
  { key: 'electricity', label: 'Electricity', uom: 'kWh', metered: true },
  { key: 'water', label: 'Water', uom: 'kL', metered: true },
  { key: 'gas', label: 'Gas', uom: 'm3', metered: true },
  { key: 'sewerage', label: 'Sewerage', uom: 'fixed', metered: false },
  { key: 'refuse', label: 'Refuse', uom: 'fixed', metered: false },
];
const kindOf = (k: string) => KINDS.find((x) => x.key === k);

const PAGE = 50;
const today = () => new Date().toISOString().slice(0, 10);

export default function UtilitiesPage() {
  const router = useRouter();
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
  const where = (m: any) => (m.unitId ? unitLabel(m.unitId) : `${propName(m.propertyId)} — bulk`);

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
        title="Utilities"
        subtitle="Municipal meters and readings. Recorded only — nothing here bills a tenant."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setShowGap((v) => !v); if (!showGap) loadGap(); }}>
              <Scale size={16} /> Recovery gap
            </Button>
            <Button onClick={() => setShowNew((v) => !v)}><Plus size={16} /> Add meter</Button>
          </div>
        }
      />

      {err && <GlassCard className="border-danger/40 p-3 text-sm text-danger">{err}</GlassCard>}

      {showNew && (
        <GlassCard className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Attached to">
              <select value={attachTo} onChange={(e) => setAttachTo(e.target.value as any)} className="input">
                <option value="unit">A unit (submeter)</option>
                <option value="property">A property (bulk meter)</option>
              </select>
            </Field>
            {attachTo === 'unit' ? (
              <Field label="Unit">
                <select value={mUnitId} onChange={(e) => setMUnitId(e.target.value)} className="input">
                  <option value="">Select…</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Property">
                <select value={mPropertyId} onChange={(e) => setMPropertyId(e.target.value)} className="input">
                  <option value="">Select…</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Utility">
              <select value={mKind} onChange={(e) => setMKind(e.target.value)} className="input">
                {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Meter number">
              <input value={mSerial} onChange={(e) => setMSerial(e.target.value)} className="input" placeholder="As printed on the meter" />
            </Field>
            {kindOf(mKind)?.metered && (
              <>
                <Field label="Dial digits">
                  <input value={mDigits} onChange={(e) => setMDigits(e.target.value)} className="input" inputMode="numeric" />
                </Field>
                <Field label="Multiplier (CT ratio)">
                  <input value={mMultiplier} onChange={(e) => setMMultiplier(e.target.value)} className="input" inputMode="decimal" />
                </Field>
              </>
            )}
          </div>
          <p className="text-xs text-muted">
            Dial digits are what makes a rollover computable. Without them a wrapped meter has to be rejected rather than guessed at.
          </p>
          <div className="flex gap-2">
            <Button onClick={createMeter} disabled={busy || (attachTo === 'unit' ? !mUnitId : !mPropertyId)}>Save meter</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </GlassCard>
      )}

      {showGap && (
        <GlassCard className="space-y-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">Recovery gap</h3>
              <p className="text-xs text-muted">
                The bulk municipal meter against the sum of the submeters under it — what was paid for and not recovered.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <Field label="Property">
                <select value={gapProperty} onChange={(e) => setGapProperty(e.target.value)} className="input">
                  <option value="">All</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Button variant="ghost" onClick={loadGap}>Refresh</Button>
              <Button variant="ghost" onClick={exportGap} disabled={gap.length === 0}><Download size={16} /> CSV</Button>
            </div>
          </div>

          {gap.length === 0 ? (
            <EmptyState>Nothing to compare yet. A gap needs a bulk reading and at least one submeter reading in the same month.</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2">Period</th>
                  <th className="py-2">Property</th>
                  <th className="py-2">Utility</th>
                  <th className="py-2 text-right">Bulk</th>
                  <th className="py-2 text-right">Submeters</th>
                  <th className="py-2 text-right">Gap</th>
                  <th className="py-2 text-right">Gap cost</th>
                </tr>
              </thead>
              <tbody>
                {gap.map((g, i) => (
                  <tr key={i} className="border-b border-line/50 last:border-0">
                    <td className="py-2">{g.period}</td>
                    <td className="py-2">{g.propertyName ?? '—'}</td>
                    <td className="py-2">{g.kind}</td>
                    <td className="py-2 text-right">{g.bulkConsumption ?? '—'}</td>
                    <td className="py-2 text-right">
                      {g.subConsumption ?? '—'}
                      {g.subMeters > 0 && <span className="ml-1 text-xs text-muted">({g.subMeters})</span>}
                    </td>
                    <td className="py-2 text-right">
                      {g.note
                        ? <span className="text-xs text-muted">{g.note}</span>
                        : <>{g.gapConsumption}{g.gapPct !== null && <span className="ml-1 text-xs text-muted">({g.gapPct}%)</span>}</>}
                    </td>
                    <td className="py-2 text-right">{g.gapCost != null ? money(g.gapCost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        {meters.length === 0 ? (
          <EmptyState>No meters yet. Add one to start capturing readings.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Where</th>
                <th className="px-4 py-3">Utility</th>
                <th className="px-4 py-3">Meter no.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3">{where(m)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.metered ? 'brand' : 'muted'}>{kindOf(m.kind)?.label ?? m.kind}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{m.serial || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => openCapture(m)}><Gauge size={16} /> Capture</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">{total} meters · page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <Button variant="ghost" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      {capture && (
        <GlassCard className="space-y-4 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{where(capture)} — {kindOf(capture.kind)?.label}</h3>
              <p className="text-xs text-muted">
                {capture.serial ? `Meter ${capture.serial}. ` : ''}
                {previous
                  ? `Previous: ${previous.reading ?? '—'} on ${previous.readingDate}`
                  : 'No previous reading — this one sets the baseline, so it records no consumption.'}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setCapture(null)}><X size={16} /></Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Reading date">
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="input" />
            </Field>
            {capture.metered && (
              <Field label={`Reading (${capture.unitOfMeasure})`}>
                <input value={cReading} onChange={(e) => setCReading(e.target.value)} className="input" inputMode="decimal" autoFocus />
              </Field>
            )}
            <Field label="Tariff per unit">
              <input value={cTariff} onChange={(e) => setCTariff(e.target.value)} className="input" inputMode="decimal" placeholder="Optional" />
            </Field>
            <Field label="Cost">
              <input value={cCost} onChange={(e) => setCCost(e.target.value)} className="input" inputMode="decimal"
                placeholder={capture.metered ? 'Or leave blank to compute' : 'Required'} />
            </Field>
          </div>

          {capture.metered && (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cRollover} onChange={(e) => setCRollover(e.target.checked)} />
                The meter rolled over
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cEstimated} onChange={(e) => setCEstimated(e.target.checked)} />
                Estimated, not read
              </label>
            </div>
          )}

          <Field label="Note">
            <input value={cNote} onChange={(e) => setCNote(e.target.value)} className="input" placeholder="Optional" />
          </Field>

          <Button onClick={submitReading} disabled={busy || (capture.metered && cReading === '')}>Save reading</Button>

          {history.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">Recent readings</p>
              <table className="w-full text-sm">
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2">{r.readingDate}</td>
                      <td className="py-2">{r.reading ?? '—'}</td>
                      <td className="py-2 text-muted">
                        {r.consumption === null || r.consumption === undefined
                          ? 'baseline'
                          : `${r.consumption} ${capture.unitOfMeasure}`}
                      </td>
                      <td className="py-2">{r.cost != null ? money(r.cost) : '—'}</td>
                      <td className="py-2">
                        {r.estimated && <Badge tone="muted">estimated</Badge>}
                        {r.rollover && <Badge tone="danger">rollover</Badge>}
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
