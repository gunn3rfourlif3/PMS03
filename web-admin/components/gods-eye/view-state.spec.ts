import {
  DEFAULT_VIEW_STATE,
  ViewState,
  decodeViewState,
  encodeViewState,
  isDefaultViewState,
  viewStateUrl,
} from './view-state';

const full: ViewState = {
  asOf: '2026-06-30',
  filter: 'arrears_90_plus',
  mode: 'table',
  selected: 'a1b2c3d4-0000-4000-8000-000000000001',
};

describe('encodeViewState', () => {
  it('omits every default, so an untouched view has a clean URL', () => {
    expect(encodeViewState(DEFAULT_VIEW_STATE)).toBe('');
    expect(viewStateUrl('/gods-eye', DEFAULT_VIEW_STATE)).toBe('/gods-eye');
    expect(isDefaultViewState(DEFAULT_VIEW_STATE)).toBe(true);
  });

  it('writes only the fields that were chosen', () => {
    const q = encodeViewState({ ...DEFAULT_VIEW_STATE, filter: 'vacant' });
    expect(q).toBe('state=vacant');
  });

  it('writes every field when all are set', () => {
    const p = new URLSearchParams(encodeViewState(full));
    expect(p.get('asOf')).toBe('2026-06-30');
    expect(p.get('state')).toBe('arrears_90_plus');
    expect(p.get('mode')).toBe('table');
    expect(p.get('unit')).toBe(full.selected);
  });

  // The whole point of the module: a saved link must keep meaning the same view.
  it('round-trips', () => {
    expect(decodeViewState(encodeViewState(full))).toEqual(full);
    expect(decodeViewState(encodeViewState(DEFAULT_VIEW_STATE))).toEqual(DEFAULT_VIEW_STATE);
  });

  it('drops values it would refuse to decode rather than emitting them', () => {
    const q = encodeViewState({
      asOf: '30-06-2026',
      filter: 'not_a_state' as any,
      mode: 'grid',
      selected: 'has spaces',
    });
    expect(q).toBe('');
  });
});

describe('decodeViewState', () => {
  it('accepts a query string with or without the leading question mark', () => {
    expect(decodeViewState('?state=vacant').filter).toBe('vacant');
    expect(decodeViewState('state=vacant').filter).toBe('vacant');
  });

  it('returns the defaults for an empty search', () => {
    expect(decodeViewState('')).toEqual(DEFAULT_VIEW_STATE);
  });

  // Links get truncated, hand-edited and outlive the states they name. A stale
  // link opens the portfolio; it does not break.
  it('falls back to the default on an unknown state', () => {
    expect(decodeViewState('state=arrears_120_plus').filter).toBeNull();
  });

  it('ignores a prototype key masquerading as a state', () => {
    expect(decodeViewState('state=toString').filter).toBeNull();
    expect(decodeViewState('state=__proto__').filter).toBeNull();
  });

  it('rejects a malformed or impossible date', () => {
    expect(decodeViewState('asOf=2026-6-3').asOf).toBeUndefined();
    expect(decodeViewState('asOf=tomorrow').asOf).toBeUndefined();
    expect(decodeViewState('asOf=2026-13-45').asOf).toBeUndefined();
  });

  // Date.parse rolls 29 February in a common year over to 1 March rather than
  // failing, so a shape check alone would accept it and answer for the wrong
  // day. This is the case that caught it.
  it('rejects a day that does not exist, and accepts a real leap day', () => {
    expect(decodeViewState('asOf=2026-02-29').asOf).toBeUndefined();
    expect(decodeViewState('asOf=2026-04-31').asOf).toBeUndefined();
    expect(decodeViewState('asOf=2028-02-29').asOf).toBe('2028-02-29');
    expect(decodeViewState('asOf=2026-06-30').asOf).toBe('2026-06-30');
  });

  it('defaults an unknown mode to the grid', () => {
    expect(decodeViewState('mode=globe').mode).toBe('grid');
    expect(decodeViewState('mode=table').mode).toBe('table');
  });

  it('refuses a unit id that is the wrong shape or too long', () => {
    expect(decodeViewState('unit=' + 'a'.repeat(65)).selected).toBeNull();
    expect(decodeViewState('unit=<script>').selected).toBeNull();
    expect(decodeViewState('unit=').selected).toBeNull();
    expect(decodeViewState('unit=abc-123').selected).toBe('abc-123');
  });

  it('ignores parameters it does not know', () => {
    expect(decodeViewState('state=vacant&sortBy=rent&page=3')).toEqual({
      ...DEFAULT_VIEW_STATE,
      filter: 'vacant',
    });
  });
});

describe('viewStateUrl', () => {
  it('joins the path and the query, and omits the question mark when empty', () => {
    expect(viewStateUrl('/gods-eye', { ...DEFAULT_VIEW_STATE, mode: 'table' }))
      .toBe('/gods-eye?mode=table');
    expect(viewStateUrl('/gods-eye', DEFAULT_VIEW_STATE)).toBe('/gods-eye');
  });
});
