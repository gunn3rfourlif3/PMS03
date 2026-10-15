/**
 * The god's-eye view's shareable state.
 *
 * Ported from God's Eye View's share links, which encode camera, styles, layers
 * and the tracked target in the URL so a view reproduces exactly for whoever
 * opens it. Same idea over a portfolio: "the five units more than 90 days down
 * at Midnight Court, as at month-end" becomes a link an operator can paste to a
 * colleague or keep as a bookmark, instead of a sentence of instructions.
 *
 * Pure and tested on purpose. A URL is a contract: if encode and decode drift,
 * every link anyone saved silently starts opening the wrong view.
 *
 * DEFAULTS ARE OMITTED from the query string, so an untouched view has a clean
 * URL and a shared link carries only what was deliberately chosen.
 *
 * UNKNOWN VALUES DECODE TO THE DEFAULT rather than throwing. Links get
 * truncated by chat clients, hand-edited, and outlive the states they named —
 * a stale link should open the portfolio, not an error page.
 */

import { STATE_STYLE, UnitState } from './state';

export type ViewMode = 'grid' | 'table';

export interface ViewState {
  /** Date the state is judged against; undefined means "today, server-side". */
  asOf?: string;
  /** Active state filter, or null for everything. */
  filter: UnitState | null;
  mode: ViewMode;
  /**
   * The property being looked at, or null for the portfolio roll-up. The
   * roll-up is the default view, so a link with no `property` opens on the ten
   * properties rather than five hundred units.
   */
  property: string | null;
  /** Selected unit id, or null. */
  selected: string | null;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  asOf: undefined,
  filter: null,
  mode: 'grid',
  property: null,
  selected: null,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ids are matched against the fetched payload, so a bad one simply selects
 * nothing. The bound exists to stop a hostile or mangled link putting an
 * unbounded string into the address bar and our own state.
 */
const ID_SHAPE = /^[A-Za-z0-9-]{1,64}$/;

function isUnitState(v: string): v is UnitState {
  return Object.prototype.hasOwnProperty.call(STATE_STYLE, v);
}

/**
 * The shape check is not enough: `Date.parse('2026-02-29T00:00:00Z')` does not
 * fail, it rolls over to 1 March — so an impossible date would be accepted and
 * then silently answer for a different day. Round-tripping through the parsed
 * date is the only check that rejects it.
 */
function isIsoDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Read a view state out of a query string (with or without the leading '?'). */
export function decodeViewState(search: string): ViewState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const rawAsOf = p.get('asOf');
  const rawFilter = p.get('state');
  const rawMode = p.get('mode');
  const rawProperty = p.get('property');
  const rawSelected = p.get('unit');

  return {
    asOf: rawAsOf && isIsoDate(rawAsOf) ? rawAsOf : undefined,
    filter: rawFilter && isUnitState(rawFilter) ? rawFilter : null,
    mode: rawMode === 'table' ? 'table' : 'grid',
    property: rawProperty && ID_SHAPE.test(rawProperty) ? rawProperty : null,
    selected: rawSelected && ID_SHAPE.test(rawSelected) ? rawSelected : null,
  };
}

/** Encode a view state as a query string, without the leading '?'. */
export function encodeViewState(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.asOf && isIsoDate(s.asOf)) p.set('asOf', s.asOf);
  if (s.filter && isUnitState(s.filter)) p.set('state', s.filter);
  if (s.mode === 'table') p.set('mode', s.mode);
  if (s.property && ID_SHAPE.test(s.property)) p.set('property', s.property);
  if (s.selected && ID_SHAPE.test(s.selected)) p.set('unit', s.selected);
  return p.toString();
}

/** `pathname` plus the encoded state, for history replacement or a copied link. */
export function viewStateUrl(pathname: string, s: ViewState): string {
  const q = encodeViewState(s);
  return q ? `${pathname}?${q}` : pathname;
}

/** True when nothing has been chosen — used to label a link as "the whole portfolio". */
export function isDefaultViewState(s: ViewState): boolean {
  return encodeViewState(s) === '';
}
