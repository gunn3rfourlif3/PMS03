'use client';

import { useLocale } from '@/components/locale-provider';

/**
 * The chart primitives, in one place, on theme tokens.
 *
 * WHY THIS FILE EXISTS. The same collection rate was drawn by two unrelated
 * components: `Ring` on the dashboard, built on `--brand` and `--ink`, and
 * `Donut` on the reports page, built on a hardcoded pastel palette. One
 * followed the theme and one did not, so the dark back office showed the one
 * figure in two different visual languages depending on the route.
 *
 * Everything here reads tokens and nothing here names a colour. That is the
 * rule that keeps a white-label product coherent: an agency swaps `--brand`
 * and every chart follows, including in dark mode, with no second palette to
 * remember to update.
 */

export type ChartTone = 'brand' | 'accent' | 'danger' | 'success' | 'muted';

const STROKE: Record<ChartTone, string> = {
  brand: 'var(--brand)',
  accent: 'var(--accent)',
  danger: 'var(--danger)',
  success: 'var(--success)',
  muted: 'var(--muted)',
};

/** The shared track. One value, so a ring and a bar sit at the same weight. */
export const TRACK = 'color-mix(in srgb, var(--ink) 12%, transparent)';

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}

/**
 * A percentage as a ring, with the figure in the middle.
 *
 * Geometry is fixed in a 120 viewBox and scaled by `size`, so the stroke stays
 * proportional and a 140px ring is the same drawing as a 168px one rather than
 * a thinner relative of it.
 */
export function Ring({
  value, size = 168, tone = 'brand', sub, decimals = 1, ariaLabel,
}: {
  value: number; size?: number; tone?: ChartTone;
  sub?: string; decimals?: number; ariaLabel?: string;
}) {
  // The ARC is clamped because a circle cannot show more than full. The FIGURE
  // is not: clamping both is how a genuine 103% — a prepayment, or a bug
  // upstream — silently rendered as a tidy, wrong 100.0%.
  const pct = clamp(value);
  const shown = Math.max(0, Number.isFinite(value) ? value : 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  const text = `${shown.toFixed(decimals)}%`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label={ariaLabel ?? (sub ? `${text} ${sub}` : text)}
      >
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" stroke={TRACK} />
        {/* No arc at all at zero — a round cap on a zero-length dash still
            paints a dot, which reads as a small value rather than none. */}
        {pct > 0 && (
          <circle
            cx="60" cy="60" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
            stroke={STROKE[tone]}
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            transform="rotate(-90 60 60)"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tabular font-bold leading-none tracking-tight text-ink"
          style={{ fontSize: Math.round(size * 0.18) }}
        >
          {text}
        </span>
        {sub && <span className="mt-1 text-[11px] text-muted">{sub}</span>}
      </div>
    </div>
  );
}

/**
 * One horizontal bar, scaled against `max`.
 *
 * A zero value draws no fill. The previous version floored the width at 1%, so
 * a band holding nothing still showed a visible pill beside the word "none".
 */
export function Bar({
  value, max, tone = 'brand',
}: { value: number; max: number; tone?: ChartTone | string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = (STROKE as Record<string, string>)[tone as string] ?? tone;
  return (
    <span className="block h-3 w-full overflow-hidden rounded-full" style={{ background: TRACK }}>
      {pct > 0 && (
        <span
          aria-hidden
          className="block h-3 rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: fill }}
        />
      )}
    </span>
  );
}

/** A bar that is always read against 100. Same treatment as `Bar`. */
export function Progress({ value, tone = 'brand' }: { value: number; tone?: ChartTone }) {
  return <Bar value={clamp(value)} max={100} tone={tone} />;
}

/**
 * Kept so the three former `Donut` callers need no change of shape. It is a
 * `Ring`; the old `tone` names map onto tokens.
 */
const LEGACY_TONE: Record<string, ChartTone> = {
  teal: 'brand', green: 'success', amber: 'accent', coral: 'danger',
  pink: 'danger', purple: 'accent', blue: 'accent',
};

export function Donut({
  value, tone = 'teal', size = 108, sub,
}: { value: number; tone?: string; size?: number; sub?: string }) {
  const { t } = useLocale();
  return (
    <Ring
      value={value}
      size={size}
      tone={LEGACY_TONE[tone] ?? 'brand'}
      sub={sub ?? t('ui.donut.onTime')}
      decimals={0}
    />
  );
}
