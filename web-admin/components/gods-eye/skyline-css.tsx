'use client';

/**
 * The skyline, drawn with CSS transforms.
 *
 * ONE OF TWO RENDERERS. It takes a `Skyline` from `skyline-layout.ts` and draws
 * it; it computes no geometry of its own beyond turning the layout's numbers
 * into pixels. A WebGL renderer replaces this file behind the same props — see
 * the note in `skyline.tsx` — so nothing above here needs to know which one is
 * mounted, and a retreat from WebGL costs one import.
 *
 * WHY CSS AND NOT WEBGL, for now: this runs in the on-site demo's mode A, where
 * there is no internet and nothing may be fetched from a host. CSS transforms
 * need no bundle, no GPU feature detection and no fallback path. What they
 * cannot do is a camera that flies BETWEEN towers: CSS 3D sorts per element,
 * not per pixel, so a camera passing through the scene would show planes
 * popping in front of things they are behind. The drift below stays outside the
 * towers for exactly that reason, and it is the ceiling on this renderer.
 *
 * DARK ON PURPOSE. The light palette makes `ok` the palest thing on the page so
 * the eye finds problems; on a tower that reads as a blank building. Here an
 * untroubled window is a dim slab and only a problem is lit, which is the same
 * intent inverted for a dark ground.
 */

import React from 'react';
import { STATE_STYLE, type StateFamily } from './state';
import type { Skyline, SkylineTower } from './skyline-layout';

export interface SkylineRendererProps {
  skyline: Skyline;
  /** Drill into a property — the same handler the roll-up's rows use. */
  onOpen: (propertyId: string) => void;
  /** The property currently open, if any, so the scene can mark it. */
  activeId: string | null;
  money: (n: number) => string;
}

/** Glow colour per family, from the three anchors `state.ts` validated. */
const FAMILY_GLOW: Record<StateFamily, string> = {
  money: '216, 90, 48',
  occupancy: '55, 138, 221',
  operations: '83, 74, 183',
  clear: '0, 0, 0',
};

const WINDOW = 13;
const GAP = 2;
const SLOT_X = 152;
const SLOT_Z = 112;
/** Each row back is lifted slightly, so a back tower is not hidden by a front one. */
const ROW_LIFT = 24;

function windowStyle(state: keyof typeof STATE_STYLE): React.CSSProperties {
  const s = STATE_STYLE[state];
  if (s.family === 'clear') {
    return { background: '#141C27', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' };
  }
  if (state === 'offline') {
    return { background: '#2A313C', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' };
  }
  return {
    background: s.bg,
    boxShadow: `0 0 8px rgba(${FAMILY_GLOW[s.family]}, 0.75), inset 0 0 0 1px rgba(255,255,255,0.14)`,
  };
}

function Tower({
  tower,
  active,
  onOpen,
  money,
}: {
  tower: SkylineTower;
  active: boolean;
  onOpen: () => void;
  money: (n: number) => string;
}) {
  const w = tower.cols * WINDOW + (tower.cols - 1) * GAP + 6;
  const h = tower.floors * WINDOW + (tower.floors - 1) * GAP + 6;
  const depth = Math.max(18, Math.round(w * 0.46));
  const pool = 96 + tower.risk * 160;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${tower.propertyName}, ${tower.units} units, ${tower.arrearsUnits} in arrears, ${money(tower.outstanding)} outstanding`}
      title={`${tower.propertyName} — ${money(tower.outstanding)} outstanding`}
      className="absolute cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{
        left: tower.col * SLOT_X,
        bottom: tower.row * ROW_LIFT,
        width: w,
        height: h,
        transform: `translateZ(${-tower.row * SLOT_Z}px)`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* The pool of light: outstanding, against the worst property. */}
      <span
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{
          bottom: -12,
          width: pool,
          height: Math.round(pool * 0.34),
          background: `radial-gradient(ellipse at center, rgba(216,90,48,${(0.08 + tower.risk * 0.4).toFixed(2)}), rgba(7,10,16,0) 70%)`,
          filter: 'blur(5px)',
        }}
      />

      {/* Front elevation: one window per unit. */}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 grid"
        style={{
          width: w,
          height: h,
          padding: 3,
          boxSizing: 'border-box',
          gap: GAP,
          gridTemplateColumns: `repeat(${tower.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${tower.floors}, minmax(0, 1fr))`,
          background: 'linear-gradient(170deg, #101823, #080C13)',
          boxShadow: active
            ? 'inset 0 0 0 1.5px rgba(255,255,255,0.55)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        {tower.windows.map((u) => (
          <span key={u.unitId} className="rounded-[1.5px]" style={windowStyle(u.state)} />
        ))}
      </span>

      {/* Right flank, to give the tower a body rather than a billboard. */}
      <span
        aria-hidden
        className="absolute bottom-0 left-0"
        style={{
          width: depth,
          height: h,
          transformOrigin: '0 0',
          transform: `translateX(${w}px) rotateY(90deg)`,
          background: 'linear-gradient(170deg, #0B111A, #05080D)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      />
    </button>
  );
}

export default function SkylineCss({ skyline, onOpen, activeId, money }: SkylineRendererProps) {
  if (!skyline.towers.length) return null;

  const rows = Math.max(1, Math.ceil(skyline.towers.length / skyline.perRow));
  const worldW = (skyline.perRow - 1) * SLOT_X + 160;
  const worldH = 300 + rows * ROW_LIFT;

  return (
    // NOT aria-hidden. The towers inside are real buttons with labels, and
    // hiding an ancestor would leave them focusable but invisible to a screen
    // reader -- the same defect the panel spec found in the focus trap.
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ background: 'radial-gradient(120% 90% at 50% 10%, #0C1220, #05070C 70%)', height: 440 }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: 2000, perspectiveOrigin: '50% 38%' }}
      >
        <div
          className="gods-eye-drift relative"
          style={{ width: worldW, height: worldH, transformStyle: 'preserve-3d' }}
        >
          {skyline.towers.map((t) => (
            <Tower
              key={t.propertyId}
              tower={t}
              active={t.propertyId === activeId}
              onOpen={() => onOpen(t.propertyId)}
              money={money}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
