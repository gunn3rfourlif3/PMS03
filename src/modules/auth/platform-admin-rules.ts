/**
 * Who may be granted platform-admin, and who may be taken off it (gap R-2).
 *
 * Pure — no framework, no DB — because these are the rules that decide who can
 * reach nineteen admin controllers, and they should be readable and testable
 * without a database.
 *
 * The same two guards are ALSO enforced inside `platform_admin_revoke()`. That
 * is not redundancy for its own sake: two admins revoking each other in the
 * same instant would each see one other admin still active and both succeed,
 * leaving the platform with none. SQL settles that race under a row lock; this
 * module exists so the UI can explain the rule before the user hits it.
 */

export interface GrantInput {
  email?: string;
  name?: string;
  note?: string;
}

export interface GrantPlan {
  email: string;
  name: string | null;
  note: string | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Deliberately permissive: the shapes a real address takes, not RFC 5322. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function planGrant(input: GrantInput): Checked<GrantPlan> {
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Enter the email address to grant access to.' };
  if (!EMAIL.test(email)) return { ok: false, error: `"${input.email?.trim()}" is not an email address.` };

  const note = (input.note ?? '').trim();
  if (!note) {
    // Six months from now, "why does this person have admin?" is a question
    // with no other answer.
    return { ok: false, error: 'Say why they need access — it is the only record of the reason.' };
  }
  if (note.length > 300) return { ok: false, error: 'Keep the reason under 300 characters.' };

  const name = (input.name ?? '').trim().replace(/\s+/g, ' ');
  return { ok: true, value: { email, name: name || null, note } };
}

export interface RevokeContext {
  /** The admin doing the revoking. */
  actorEmail?: string;
  /** The address being revoked. */
  targetEmail?: string;
  /** How many grants are currently active, including the target. */
  activeCount: number;
}

/**
 * `ok: false` here is a refusal with a reason the operator can act on, not an
 * error. Both cases are recoverable, and the message says how.
 */
export function checkRevoke(ctx: RevokeContext): Checked<true> {
  const actor = (ctx.actorEmail ?? '').trim().toLowerCase();
  const target = (ctx.targetEmail ?? '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'No operator selected.' };

  if (actor && actor === target) {
    return {
      ok: false,
      error: 'You cannot remove your own access — this is the screen you would need to undo it. '
        + 'Ask another admin to do it.',
    };
  }
  if (ctx.activeCount <= 1) {
    return {
      ok: false,
      error: 'This is the last platform admin. Removing it would lock everyone out of the back office. '
        + 'Grant someone else first.',
    };
  }
  return { ok: true, value: true };
}
