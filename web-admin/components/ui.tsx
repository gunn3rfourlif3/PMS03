'use client';
import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Loader2, X, ChevronLeft } from 'lucide-react';

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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

// Landing pages that shouldn't show a back button.
const ROOT_PATHS = ['/', '/portal', '/login'];

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const showBack = !ROOT_PATHS.includes(path);
  // Portal sub-pages go back to the portal overview; everything else uses history.
  const goBack = () => (path.startsWith('/portal') ? router.push('/portal') : router.back());

  return (
    <div className="mb-6 animate-fade-up">
      {showBack && (
        <button onClick={goBack}
          className="mb-3 inline-flex items-center gap-1 rounded-lg py-1 pr-2.5 pl-1.5 text-sm font-medium text-muted transition hover:bg-white/50 hover:text-brand">
          <ChevronLeft size={16} /> Back
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
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/50 hover:text-ink"><X size={18} /></button>
          </div>
        )}
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog — replaces window.confirm. */
export function ConfirmModal({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'brand', loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string;
  message?: React.ReactNode; confirmLabel?: string; tone?: 'brand' | 'danger'; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={onConfirm} loading={loading} className={tone === 'danger' ? '!bg-danger' : undefined}>{confirmLabel}</Button>
      </>}>
      {message && <p className="text-sm text-muted">{message}</p>}
    </Modal>
  );
}

export function Metric({
  label, value, icon, accent, tone,
}: { label: string; value: React.ReactNode; icon?: React.ReactNode; accent?: boolean; tone?: 'danger' | 'success' }) {
  const valueColor = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : accent ? 'text-brand' : 'text-ink';
  return (
    <GlassCard hover className={cn('!p-5', accent && 'ring-1 ring-brand/40')}>
      <div className="flex items-start justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        {icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
            {icon}
          </span>
        )}
      </div>
      <div className={cn('mt-2 font-heading text-2xl sm:text-[26px] font-bold', valueColor)}>{value}</div>
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

export function Donut({ value, tone = 'teal', size = 108, sub = 'on time' }: { value: number; tone?: BentoTone; size?: number; sub?: string }) {
  const c = BENTO[tone];
  const r = size * 0.39, circ = 2 * Math.PI * r, dash = (Math.max(0, Math.min(100, value)) / 100) * circ, ctr = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={ctr} cy={ctr} r={r} fill="none" stroke={c.chip} strokeWidth="12" />
        <circle cx={ctr} cy={ctr} r={r} fill="none" stroke={c.bar} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${ctr} ${ctr})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-bold" style={{ color: c.text }}>{Math.round(value)}%</span>
        <span className="text-[11px]" style={{ color: c.sub }}>{sub}</span>
      </div>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: 'linear-gradient(90deg, color-mix(in srgb, var(--brand) 80%, white), var(--brand))' }} />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>;
}

export const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');
