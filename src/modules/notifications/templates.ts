import { Channel } from '@providers/notification/notification-provider.interface';
import { renderEmail } from '@common/email/email';
import { EmailBrand } from '@common/email/email-brand';

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
  /** Optional rich-email config: renders a "click here" button from a payload URL. */
  email?: {
    heading: string; // may contain {{var}} placeholders
    paragraph: string; // body text for the HTML email (no raw URL — the button carries it)
    label: string; // button label
    urlKey: string; // payload key holding the button URL (button omitted if absent)
  };
}

export const TEMPLATES: Record<TemplateKey, Template> = {
  RENT_INVOICE_ISSUED: {
    key: 'RENT_INVOICE_ISSUED',
    defaultChannels: ['push', 'email'],
    subject: 'Rent invoice for {{period}}',
    body: 'Hi {{name}}, your rent invoice for {{period}} of {{currency}} {{amount}} is due on {{dueDate}}.{{invoiceLink}}',
    email: {
      heading: 'Your rent invoice for {{period}}',
      paragraph: 'Hi {{name}}, your rent invoice for {{period}} of {{currency}} {{amount}} is due on {{dueDate}}.',
      label: 'View your invoice',
      urlKey: 'invoiceUrl',
    },
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
  brand: EmailBrand = {},
): { subject: string; body: string; html?: string } {
  const t = TEMPLATES[key];
  const subject = render(t.subject, payload);
  const body = render(t.body, payload);
  let html: string | undefined;
  if (t.email) {
    const url = payload[t.email.urlKey];
    html = renderEmail({
      ...brand,
      heading: render(t.email.heading, payload),
      paragraphs: [render(t.email.paragraph, payload)],
      buttons: url ? [{ label: t.email.label, url: String(url) }] : [],
    });
  }
  return { subject, body, html };
}
