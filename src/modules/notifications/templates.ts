import { Channel } from '@providers/notification/notification-provider.interface';

/**
 * Notification templates. Pure: `render` interpolates {{var}} placeholders from
 * a payload. Each template declares its default channels. Keys are stable
 * identifiers referenced by domain events.
 */
export type TemplateKey = 'RENT_INVOICE_ISSUED' | 'PAYMENT_RECEIVED' | 'RENT_OVERDUE';

export interface Template {
  key: TemplateKey;
  defaultChannels: Channel[];
  subject: string;
  body: string;
}

export const TEMPLATES: Record<TemplateKey, Template> = {
  RENT_INVOICE_ISSUED: {
    key: 'RENT_INVOICE_ISSUED',
    defaultChannels: ['push', 'email'],
    subject: 'Rent invoice for {{period}}',
    body: 'Hi {{name}}, your rent invoice for {{period}} of {{currency}} {{amount}} is due on {{dueDate}}.',
  },
  PAYMENT_RECEIVED: {
    key: 'PAYMENT_RECEIVED',
    defaultChannels: ['push', 'email'],
    subject: 'Payment received',
    body: 'Thanks {{name}}, we received your payment of {{currency}} {{amount}}.',
  },
  RENT_OVERDUE: {
    key: 'RENT_OVERDUE',
    defaultChannels: ['push', 'sms', 'email'],
    subject: 'Rent overdue',
    body: 'Hi {{name}}, your rent for {{period}} is overdue. A late fee of {{currency}} {{lateFee}} has been applied.',
  },
};

/** Replace {{key}} placeholders; missing keys render as empty string. */
export function render(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) =>
    payload[k] === undefined || payload[k] === null ? '' : String(payload[k]),
  );
}

export function renderTemplate(
  key: TemplateKey,
  payload: Record<string, unknown>,
): { subject: string; body: string } {
  const t = TEMPLATES[key];
  return { subject: render(t.subject, payload), body: render(t.body, payload) };
}
