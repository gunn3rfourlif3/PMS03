'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Check, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, GlassCard } from '@/components/ui';

/**
 * Create a direct-sold agency (gap R-3).
 *
 * The operator types a portfolio size, not a tier: the price is derived and
 * shown live, so the commercial consequence of the number is visible while it
 * is still being typed. Below the billable minimum the form refuses to save
 * until an agreed price, a reason and an end date are captured — deliberately
 * at the moment of the sale, rather than weeks later when billing blocks it.
 */

interface Preview {
  ok: boolean;
  error?: string;
  field?: string | null;
  slug?: string;
  tier?: string;
  mrr?: number;
  unitCount?: number;
  tierOverridden?: boolean;
}

const money = (n?: number) =>
  typeof n === 'number' ? `R${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}` : '—';

const TIER_LABEL: Record<string, string> = {
  custom: 'Custom', starter: 'Starter', growth: 'Growth', scale: 'Scale',
};

const input = 'w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand';

/**
 * MODULE SCOPE, deliberately. Defined inside the component this would be a new
 * component type on every render, so React would unmount and remount every
 * input instead of updating it — the field loses focus on the first keystroke
 * and autoFocus yanks the caret back to the first field. It is only a wrapper
 * around a label; it must stay out here.
 */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default function NewAgencyForm({ onCreated, onCancel }: {
  onCreated: (r: { vendorId: string; agencyName: string; onboardingItems: number }) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    agencyName: '', slug: '', ownerName: '', ownerEmail: '', unitCount: '',
    tier: '', priceOverride: '', priceOverrideReason: '', priceOverrideUntil: '',
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const seq = useRef(0);

  const set = (k: keyof typeof f) => (e: any) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Price as they type. Debounced, and stamped with a sequence number so a slow
  // response cannot overwrite a newer one — which would show a price for a unit
  // count no longer on screen.
  const refresh = useCallback(() => {
    const mine = ++seq.current;
    api.previewAgency(f)
      .then((p) => { if (mine === seq.current) setPreview(p); })
      .catch(() => { if (mine === seq.current) setPreview(null); });
  }, [f]);

  useEffect(() => {
    if (!f.agencyName && !f.unitCount) { setPreview(null); return; }
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
  }, [f, refresh]);

  const belowFloor = preview?.field === 'priceOverride'
    || preview?.field === 'priceOverrideReason'
    || preview?.field === 'priceOverrideUntil';

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api.createAgency(f);
      onCreated({ vendorId: r.vendorId, agencyName: r.agencyName, onboardingItems: r.onboardingItems ?? 0 });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <GlassCard className="mb-4">
      <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-ink">
        <Building2 size={18} /> New agency
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Agency name">
          <input className={input} value={f.agencyName} onChange={set('agencyName')} placeholder="Northcliff Letting" autoFocus />
        </Field>
        <Field label="Web address" hint={preview?.slug ? `${preview.slug}.locare.co.za` : 'Built from the name unless you set one.'}>
          <input className={input} value={f.slug} onChange={set('slug')} placeholder="northcliff-letting" spellCheck={false} />
        </Field>
        <Field label="Owner name">
          <input className={input} value={f.ownerName} onChange={set('ownerName')} placeholder="Thandi Mokoena" />
        </Field>
        <Field label="Owner email" hint="How they sign in. No email is sent now.">
          <input className={input} value={f.ownerEmail} onChange={set('ownerEmail')} placeholder="owner@agency.co.za" spellCheck={false} />
        </Field>
        <Field label="Units under management" hint="Sets the tier and the price.">
          <input
            className={input}
            value={f.unitCount}
            // Digits only. "199d" parses to NaN and the form then complains
            // about whichever field fails first, which reads as a bug.
            onChange={(e) => setF((p) => ({ ...p, unitCount: e.target.value.replace(/[^0-9]/g, '') }))}
            inputMode="numeric"
            placeholder="48"
          />
        </Field>
        <Field label="Tier" hint={preview?.tierOverridden ? 'Overriding what the unit count implies.' : 'Derived from the units.'}>
          <select className={input} value={f.tier} onChange={set('tier')}>
            <option value="">Derive from units{preview?.ok && preview.tier ? ` — ${TIER_LABEL[preview.tier]}` : ''}</option>
            {Object.entries(TIER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>

      {/* Live price. Shown whenever it can be computed, so the number is on
          screen while the unit count is still being decided. */}
      {preview?.ok && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-line px-3 py-2 text-sm">
          <span className="text-muted">{preview.unitCount} units</span>
          <span className="text-ink">{TIER_LABEL[preview.tier ?? ''] ?? preview.tier}</span>
          <span className="font-heading text-lg font-bold text-brand">{money(preview.mrr)}<span className="text-xs font-normal text-muted">/month</span></span>
          {f.priceOverride && <span className="text-muted">billed at <span className="text-ink">{money(Number(f.priceOverride))}</span></span>}
        </div>
      )}

      {/* The below-minimum gate. Appears only when it applies, and says what it
          would cost at list price so the discount being given is explicit. */}
      {belowFloor && (
        <div className="mt-4 rounded-xl border border-line p-3" style={{ background: 'color-mix(in srgb, var(--danger) 6%, transparent)' }}>
          <div className="mb-2 flex items-start gap-2 text-sm text-danger">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>{preview?.error}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Agreed price / month">
              <input className={input} value={f.priceOverride} onChange={set('priceOverride')} inputMode="decimal" placeholder="1500" />
            </Field>
            <Field label="Reason">
              <input className={input} value={f.priceOverrideReason} onChange={set('priceOverrideReason')} placeholder="Founding customer" />
            </Field>
            <Field label="Until">
              <input className={input} type="date" value={f.priceOverrideUntil} onChange={set('priceOverrideUntil')} />
            </Field>
          </div>
        </div>
      )}

      {/* Anything else the planner objects to — a bad email, a reserved slug. */}
      {preview && !preview.ok && !belowFloor && (
        <div className="mt-3 text-sm text-muted">{preview.error}</div>
      )}
      {err && <div className="mt-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={submit} loading={busy} disabled={!preview?.ok}>
          <Check size={14} /> Create agency
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <span className="text-xs text-muted">Creates the agency, its owner and its onboarding checklist. Sends nothing.</span>
      </div>
    </GlassCard>
  );
}
