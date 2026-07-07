import React from 'react';
import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';

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

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gradient">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
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
