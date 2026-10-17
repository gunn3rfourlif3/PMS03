'use client';

/**
 * The skyline: the whole portfolio as towers, and the portfolio-level
 * counterpart to the unit grid.
 *
 * THIS FILE IS THE CONTAINER, not the drawing. It turns the payload into a
 * `Skyline` (pure, `skyline-layout.ts`), renders the ranking and the legend,
 * and hands the geometry to a renderer.
 *
 * SWAPPING IN WEBGL. `SkylineCss` below is one implementation of
 * `SkylineRendererProps`. A WebGL version is a second file with the same props,
 * mounted through `next/dynamic` with `ssr: false` so its bundle never reaches
 * the roll-up, the grid or any other route:
 *
 *   const SkylineGl = dynamic(() => import('./skyline-gl'), { ssr: false });
 *
 * Nothing else here changes, because the renderer is handed numbers and gives
 * back pixels. Note the constraint that decides when that is worth doing:
 * this view runs in the on-site demo's mode A with no internet, so any 3D
 * library has to be a bundled dependency, never a script from a host.
 *
 * THE RANKING IS NOT DECORATION. It is the accessible path and the narrow-screen
 * path, carrying the same order as the towers, which is why the scene is hidden
 * under `lg` rather than squeezed.
 */

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { FAMILY_LABEL, type PortfolioUnit, type StateFamily } from './state';
import { buildSkyline, describeSkyline } from './skyline-layout';
import SkylineCss from './skyline-css';

export interface SkylineProps {
  units: PortfolioUnit[];
  onOpen: (propertyId: string) => void;
  activeId: string | null;
  money: (n: number) => string;
  number: (n: number) => string;
  t: (key: any, vars?: any) => string;
}

/** Legend order: worst family first, matching the roll-up's bars. */
const FAMILIES: readonly StateFamily[] = ['money', 'occupancy', 'operations', 'clear'];

const LEGEND_SWATCH: Record<StateFamily, { bg: string; glow: string }> = {
  money: { bg: '#993C1D', glow: 'rgba(216,90,48,0.6)' },
  occupancy: { bg: '#185FA5', glow: 'rgba(55,138,221,0.6)' },
  operations: { bg: '#534AB7', glow: 'rgba(83,74,183,0.6)' },
  clear: { bg: '#141C27', glow: 'transparent' },
};

export default function Skyline({ units, onOpen, activeId, money, number, t }: SkylineProps) {
  const skyline = useMemo(() => buildSkyline(units), [units]);

  if (!skyline.towers.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted)]">
        No properties to show.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t('godsEye.sceneView')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('godsEye.skylineHint')}</p>
      </div>

      {/* The scene. Hidden rather than shrunk below lg: a 44px-wide tower on a
          phone carries nothing the ranking does not carry better. */}
      <div className="hidden lg:block">
        <SkylineCss skyline={skyline} onOpen={onOpen} activeId={activeId} money={money} />
      </div>
      <p className="text-sm text-[var(--muted)] lg:hidden">{t('godsEye.skylineNarrow')}</p>

      {/* The same sentence the scene makes, for anyone not looking at it. */}
      <p className="sr-only" role="status">
        {describeSkyline(skyline)}
      </p>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
        {FAMILIES.map((fam) => (
          <li key={fam} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-[3px]"
              style={{
                background: LEGEND_SWATCH[fam].bg,
                boxShadow:
                  fam === 'clear'
                    ? 'inset 0 0 0 1px rgba(22,24,29,0.25)'
                    : `0 0 8px ${LEGEND_SWATCH[fam].glow}`,
              }}
            />
            {fam === 'clear' ? t('godsEye.nothingOutstanding') : FAMILY_LABEL[fam]}
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--line)] pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t('godsEye.mostAtRisk')}
        </h3>
        <ul className="mt-1 flex flex-col">
          {skyline.towers.map((tw) => (
            <li key={tw.propertyId} className="border-t border-[var(--line)] first:border-t-0">
              <button
                type="button"
                onClick={() => onOpen(tw.propertyId)}
                aria-current={tw.propertyId === activeId ? 'true' : undefined}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-1 py-2.5 text-left transition hover:bg-[var(--bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
              >
                <span className="w-full min-w-0 sm:w-56 sm:shrink-0">
                  <span className="block truncate text-sm font-medium">{tw.propertyName}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {number(tw.units)} {t('godsEye.unitsInProperty')}
                  </span>
                </span>
                <span className="flex-1 text-right sm:w-36 sm:flex-none">
                  <span className="block text-sm font-semibold tabular-nums">
                    {tw.outstanding > 0 ? money(tw.outstanding) : '—'}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {number(tw.arrearsUnits)} {t('godsEye.inArrears')}
                  </span>
                </span>
                <ChevronRight aria-hidden className="shrink-0 text-[var(--muted)]" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {skyline.hidden > 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          {t('godsEye.skylineNotDrawn', {
            properties: number(skyline.hidden),
            units: number(skyline.hiddenUnits),
          })}
        </p>
      )}
    </div>
  );
}
