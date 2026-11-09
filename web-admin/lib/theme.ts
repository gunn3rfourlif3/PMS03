/**
 * Which theme a deployment serves.
 *
 * THE SAME GATE AS `DEPLOYMENT_LOCALE`, for the same reason. Dark exists for a
 * client demo; every production container leaves `DEPLOYMENT_THEME` unset and
 * gets light, so no agency wakes up to a repainted back office because a demo
 * needed one.
 *
 * UNKNOWN DEGRADES TO LIGHT rather than throwing — the call `resolveLocale`
 * makes, and deliberately NOT the one `resolveDeploymentProfile` makes. That
 * one throws because falling back would unseal an installation someone
 * configured to be closed. A wrong theme is cosmetic; a wrong profile is a
 * security change. Failing soft here, hard there, is the difference.
 */

export type Theme = 'light' | 'dark';

export const DEFAULT_THEME: Theme = 'light';

const THEMES: readonly Theme[] = ['light', 'dark'];

export function resolveTheme(value?: string | null): Theme {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return DEFAULT_THEME;
  return (THEMES as readonly string[]).includes(raw) ? (raw as Theme) : DEFAULT_THEME;
}
