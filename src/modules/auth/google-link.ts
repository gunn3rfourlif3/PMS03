/**
 * Pure account-linking decision for Google sign-in (design §4). Kept side-effect
 * free so it's unit-testable without a database.
 *
 *  - use:      a user already has this Google `sub` → sign them in.
 *  - link:     a user exists by email with no (or the same) Google account → link.
 *  - conflict: the email belongs to a *different* Google account → refuse.
 *  - create:   no matching user → make a new one.
 */
export type GoogleLinkAction = 'use' | 'link' | 'conflict' | 'create';

export function decideGoogleLink(
  hasSubMatch: boolean,
  emailUser: { googleSub?: string | null } | null | undefined,
  sub: string,
): GoogleLinkAction {
  if (hasSubMatch) return 'use';
  if (emailUser) {
    if (emailUser.googleSub && emailUser.googleSub !== sub) return 'conflict';
    return 'link';
  }
  return 'create';
}
