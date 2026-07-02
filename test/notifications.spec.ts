import { render, renderTemplate } from '../src/modules/notifications/templates';
import { allowedChannels, inQuietHours } from '../src/modules/notifications/preferences';

describe('notification templates', () => {
  it('interpolates placeholders', () => {
    expect(render('Hi {{name}}, {{currency}} {{amount}}', { name: 'Sam', currency: 'ZAR', amount: 950 }))
      .toBe('Hi Sam, ZAR 950');
  });
  it('renders missing vars as empty', () => {
    expect(render('X{{missing}}Y', {})).toBe('XY');
  });
  it('renders a known template', () => {
    const { subject } = renderTemplate('RENT_INVOICE_ISSUED', { period: '2026-07' });
    expect(subject).toBe('Rent invoice for 2026-07');
  });
});

describe('notification preferences', () => {
  it('drops opted-out channels', () => {
    expect(allowedChannels(['push', 'email'], { optedOut: ['push'] }, 12)).toEqual(['email']);
  });
  it('suppresses interruptive channels during quiet hours but keeps email', () => {
    const prefs = { optedOut: [], quietHours: { startHour: 22, endHour: 7 } };
    expect(allowedChannels(['push', 'sms', 'email'], prefs, 2)).toEqual(['email']);
  });
  it('quiet hours wrap midnight correctly', () => {
    const q = { startHour: 22, endHour: 7 };
    expect(inQuietHours(23, q)).toBe(true);
    expect(inQuietHours(3, q)).toBe(true);
    expect(inQuietHours(12, q)).toBe(false);
  });
});
