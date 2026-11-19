'use client';
import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Loader2, X, ChevronLeft } from 'lucide-react';
import { useLocale } from './locale-provider';
import { DEFAULT_LOCALE, money as formatMoney } from '@shared/i18n';

type Div = React.HTMLAttributes<HTMLDivElement>;

/** Frosted glass surface. */
export function GlassCard({ className, strong, hover, ...rest }: Div & { strong?: boolean; hover?: boolean }) {
  return <div className={cn(strong ? 'glass-strong' : 'glass', hover && 'glass-hover', 'p-5 sm:p-6', className)} {...rest} />;
}

export function Button({
  children, variant = 'primary', loading, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost'; loading?: boolean }) {
  return (
    <button className={cn('btn', variant === 'primary' ? 'btn-primary' : 'btn-ghost', className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'danger' | 'success' | 'muted' }) {
  const map = { brand: 'chip', danger: 'chip chip-danger', success: 'chip chip-success', muted: 'chip chip-muted' }[tone];
  return <span className={map}>{children}</span>;
}

export function Field({ label, children, hint, error, required, wide }: {
  label: string; children: React.ReactNode;
  /** Shown under the control. Say what the value does, not what it is. */
  hint?: string;
  /** Replaces the hint when set. The control should also carry aria-invalid. */
  error?: string;
  required?: boolean;
  /** Span both columns of a .fields grid. */
  wide?: boolean;
}) {
  return (
    <label className={cn('block', wide && 'wide')}>
      <span className="field-label">
        {label}{required && <span className="field-req"> *</span>}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span>
        : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** A figure the system owns — posted through the ledger, so not editable here.
 *  Visibly not an input, because that distinction is the product. */
export function Derived({ label, value, note, href, linkLabel }: {
  label: string; value: React.ReactNode; note?: string; href?: string; linkLabel?: string;
}) {
  return (
    <div className="block">
      <span className="field-label">{label}</span>
      <div className="derived">
        {note && <span className="text-[13px] text-muted">{note}</span>}
        <span className="ml-auto flex items-baseline gap-3.5">
          <b>{value}</b>
          {href && <a href={href} className="whitespace-nowrap text-xs font-semibold text-brand hover:underline">{linkLabel ?? 'View'}</a>}
        </span>
      </div>
    </div>
  );
}

/** A small closed set — lease type, period, mode. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className="switch" onClick={() => onChange(!checked)} />
  );
}

/** A titled form section. The subtitle is where the consequence goes. */
export function Section({ title, subtitle, action, children, tone }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <section className={cn('glass p-5 sm:p-6', tone === 'danger' && 'border-danger/25')}>
      <div className="flex items-baseline justify-between gap-3.5">
        <h2 className="font-heading text-base">{title}</h2>
        {action}
      </div>
      {subtitle && <p className="mt-1 mb-4 max-w-[62ch] text-[12.5px] text-muted">{subtitle}</p>}
      {children}
    </section>
  );
}

/** Sticky actions for a long form. Says what changed, not just "Save". */
export function SaveBar({ state, children }: { state?: string; children: React.ReactNode }) {
  return (
    <div className="savebar">
      {state && (
        <span className="flex items-center gap-2.5 text-[13px] text-muted">
          <span className="h-2 w-2 rounded-full bg-danger" aria-hidden /> {state}
        </span>
      )}
      <span className="ml-auto flex gap-2.5">{children}</span>
    </div>
  );
}

// Landing pages that shouldn't show a back button.
const ROOT_PATHS = ['/', '/portal', '/login'];

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const showBack = !ROOT_PATHS.includes(path);
  // Portal sub-pages go back to the portal overview; everything else uses history.
  const goBack = () => (path.startsWith('/portal') ? router.push('/portal') : router.back());

  return (
    <div className="mb-6 animate-fade-up">
      {showBack && (
        <button onClick={goBack}
          className="mb-3 inline-flex items-center gap-1 rounded-lg py-1 pr-2.5 pl-1.5 text-sm font-medium text-muted transition hover:bg-black/5 hover:text-brand">
          <ChevronLeft size={16} /> {t('ui.back')}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gradient">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * Frosted glass modal dialog. Closes on Escape or backdrop click.
 * Render with `open` controlling visibility.
 */
export function Modal({
  open, onClose, title, children, footer, size = 'md',
}: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode;
  footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div className={cn('glass-strong relative w-full rounded-3xl p-6 shadow-soft animate-fade-up', width)} role="dialog" aria-modal="true">
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
            <ModalCloseButton onClose={onClose} />
          </div>
        )}
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* Split out so `Modal` itself stays usable from anywhere: the close button is
   the only part that needs the translator, and an icon-only button needs an
   accessible name regardless of language. */
function ModalCloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  return (
    <button onClick={onClose} aria-label={t('ui.closeDialog')}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-black/5 hover:text-ink"><X size={18} /></button>
  );
}

/** Confirmation dialog — replaces window.confirm. */
export function ConfirmModal({
  open, onClose, onConfirm, title, message, confirmLabel, tone = 'brand', loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string;
  message?: React.ReactNode; confirmLabel?: string; tone?: 'brand' | 'danger'; loading?: boolean;
}) {
  const { t } = useLocale();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} loading={loading} className={tone === 'danger' ? '!bg-danger' : undefined}>{confirmLabel ?? t('ui.confirm')}</Button>
      </>}>
      {message && <p className="text-sm text-muted">{message}</p>}
    </Modal>
  );
}

export function Metric({
  label, value, icon, accent, tone,
  note,
}: {
  label: string; value: React.ReactNode; icon?: React.ReactNode; accent?: boolean;
  tone?: 'danger' | 'success';
  /** One line under the figure: what it is measured against. */
  note?: string;
}) {
  const valueColor = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : accent ? 'text-brand' : 'text-ink';
  return (
    <GlassCard hover className={cn('!p-5', accent && 'ring-1 ring-brand/40')}>
      <div className="flex items-start justify-between">
        <span className="eyebrow">{label}</span>
        {icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
            {icon}
          </span>
        )}
      </div>
      <div className={cn('mt-2 font-heading text-[28px] sm:text-[30px] font-extrabold tabular-nums tracking-[-0.035em]', valueColor)}>{value}</div>
      {note && <div className="mt-1.5 text-[12.5px] text-muted">{note}</div>}
    </GlassCard>
  );
}

/* ── Bento primitives ─────────────────────────────────────────────────────
   A small palette of colour-blocked tiles used across the redesigned pages. */
export const BENTO = {
  purple: { bg: '#AFA9EC', text: '#26215C', sub: '#3C3489', chip: '#CECBF6', bar: '#534AB7' },
  teal:   { bg: '#9FE1CB', text: '#04342C', sub: '#0F6E56', chip: '#C3ECDD', bar: '#0F6E56' },
  coral:  { bg: '#F5C4B3', text: '#4A1B0C', sub: '#993C1D', chip: '#F0D7CD', bar: '#D85A30' },
  amber:  { bg: '#FAC775', text: '#412402', sub: '#854F0B', chip: '#F6D9A2', bar: '#BA7517' },
  blue:   { bg: '#B5D4F4', text: '#042C53', sub: '#185FA5', chip: '#CFE2F7', bar: '#378ADD' },
  pink:   { bg: '#F4C0D1', text: '#4B1528', sub: '#993556', chip: '#F4D3DE', bar: '#D4537E' },
  green:  { bg: '#C0DD97', text: '#173404', sub: '#3B6D11', chip: '#D3E8B6', bar: '#639922' },
} as const;
export type BentoTone = keyof typeof BENTO;

export function BentoTile({ tone, icon, value, label, chip, className }: {
  tone: BentoTone; icon?: React.ReactNode; value: React.ReactNode; label: string; chip?: string; className?: string;
}) {
  const c = BENTO[tone];
  return (
    <div className={cn('flex min-h-[104px] flex-col justify-between rounded-3xl p-5', className)} style={{ background: c.bg }}>
      <div className="flex items-center justify-between">
        {icon && <span style={{ color: c.sub }}>{icon}</span>}
        {chip && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: c.chip, color: c.text }}>{chip}</span>}
      </div>
      <div>
        <div className="font-heading text-2xl font-bold leading-none" style={{ color: c.text }}>{value}</div>
        <div className="mt-1 text-xs font-medium" style={{ color: c.sub }}>{label}</div>
      </div>
    </div>
  );
}

/* The chart primitives live in components/charts.tsx, on theme tokens. They are
   re-exported here so existing imports from '@/components/ui' keep working. */
export { Ring, Bar, Progress, Donut, TRACK } from './charts';
export type { ChartTone } from './charts';

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>;
}

/**
 * @deprecated Locale-unaware. Use `useLocale().money` instead.
 *
 * This was `'R' + Number(n).toLocaleString('en-ZA')` — South African grouping
 * hardcoded into every page that imported it. It is kept, formatting in the
 * DEFAULT locale, only because routes outside this plan's day list still import
 * it (`app/rentals`, `app/admin/*`, `components/new-agency-form`): removing it
 * would break them, and silently guessing a locale from a plain function that
 * cannot see the provider would be worse. It now at least goes through the one
 * shared formatter, so the ZAR rule holds in one place.
 *
 * Every route swept on Days 3–5 uses the hook and does NOT import this.
 */
export const money = (n: number) => formatMoney(DEFAULT_LOCALE, Number(n));
