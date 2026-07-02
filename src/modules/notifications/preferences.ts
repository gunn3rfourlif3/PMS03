import { Channel } from '@providers/notification/notification-provider.interface';

/**
 * Pure preference + quiet-hours resolution. Given a user's per-channel opt-outs
 * and optional quiet-hours window, decide which channels a notification may use
 * right now. Quiet hours suppress interruptive channels (push/sms/whatsapp) but
 * NOT email/in_app, which are non-interruptive.
 */
export interface NotificationPrefs {
  optedOut: Channel[]; // channels the user disabled
  quietHours?: { startHour: number; endHour: number }; // local 0-23, may wrap
}

const INTERRUPTIVE: Channel[] = ['push', 'sms', 'whatsapp'];

export function inQuietHours(hour: number, q?: { startHour: number; endHour: number }): boolean {
  if (!q) return false;
  const { startHour, endHour } = q;
  return startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour; // wraps midnight
}

export function allowedChannels(
  requested: Channel[],
  prefs: NotificationPrefs,
  hour: number,
): Channel[] {
  const quiet = inQuietHours(hour, prefs.quietHours);
  return requested.filter((c) => {
    if (prefs.optedOut.includes(c)) return false;
    if (quiet && INTERRUPTIVE.includes(c)) return false;
    return true;
  });
}
