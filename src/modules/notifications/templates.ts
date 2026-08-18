import { Channel } from '@providers/notification/notification-provider.interface';
import { renderEmail } from '@common/email/email';
import { EmailBrand } from '@common/email/email-brand';

/**
 * Notification templates. Pure: `render` interpolates {{var}} placeholders from
 * a payload. Each template declares its default channels. Keys are stable
 * identifiers referenced by domain events.
 */
export type TemplateKey =
  | 'RENT_INVOICE_ISSUED' | 'PAYMENT_RECEIVED' | 'RENT_OVERDUE'
  | 'DEBIT_ORDER_STOPPED' | 'DEBIT_ORDER_STOPPED_AGENCY';

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

  /**
   * TENANT — the debit order stopped (docs/LOCARE_DEBIT_ORDER_DESIGN.md §11.9).
   *
   * Sent the same day the mandate leaves a collecting state. If nobody tells
   * the tenant, they simply don't pay and land in arrears through an
   * administrative event rather than a decision — then get chased by dunning
   * for it.
   *
   * Tone is deliberate: this is not a warning and not an accusation. Most
   * revocations are a bank action or an expired contract, not the tenant
   * dodging rent, and a threatening message to someone who has paid on time for
   * two years is how an agency loses a good tenant. SMS is included because
   * this is time-critical and email alone gets missed.
   */
  DEBIT_ORDER_STOPPED: {
    key: 'DEBIT_ORDER_STOPPED',
    defaultChannels: ['push', 'sms', 'email'],
    subject: 'Your rent debit order has stopped — action needed',
    body: 'Hi {{name}}, the debit order for your rent at {{propertyName}} is no longer active, so your next payment of {{currency}} {{amount}} on {{dueDate}} will not go off automatically. Please pay it manually this month. {{payLink}}',
    email: {
      heading: 'Your rent debit order has stopped',
      paragraph: 'The debit order for {{propertyName}} is no longer active, so your rent of {{currency}} {{amount}} due on {{dueDate}} will not be collected automatically. Please pay it manually this month — your account is up to date, and we will be in touch about setting the debit order up again.',
      label: 'Pay your rent',
      urlKey: 'payUrl',
    },
  },

  /** AGENCY — same event, staff side. Their action is re-authorising the mandate. */
  DEBIT_ORDER_STOPPED_AGENCY: {
    key: 'DEBIT_ORDER_STOPPED_AGENCY',
    defaultChannels: ['push', 'email'],
    subject: 'Debit order stopped: {{tenantName}} at {{propertyName}}',
    body: 'The DebiCheck mandate for {{tenantName}} at {{propertyName}} moved to {{state}}{{reasonSuffix}}. The tenant has been asked to pay manually. Re-authorise the mandate to resume automatic collection.',
    email: {
      heading: 'Debit order stopped for {{tenantName}}',
      paragraph: 'The DebiCheck mandate for {{tenantName}} at {{propertyName}} moved to {{state}}{{reasonSuffix}}. The tenant has been notified and asked to pay manually this month. Collection will not resume until a new mandate is authorised.',
      label: 'Open the lease',
      urlKey: 'leaseUrl',
    },
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
