import { Channel } from '@providers/notification/notification-provider.interface';
import { EmailOptions, renderEmail } from '@common/email/email';
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
  /**
   * A purpose-built HTML layout, used instead of `email` when the payload has
   * what it needs. Returns null to fall back to the simple layout (e.g. a job
   * queued before the payload carried line items).
   */
  buildEmail?: (payload: Record<string, unknown>, brand: EmailBrand) => EmailOptions | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** "R 10 500.00" — space-grouped thousands, point decimals, as SA invoices print. */
export function zar(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const [whole, cents] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '−' : ''}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${cents}`;
}
/** "2026-11" → "November 2026". Unparseable input is returned as given. */
export function periodLabel(p: unknown): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(p ?? ''));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(p ?? '');
}
/** "2026-11-07" → "7 November 2026". */
export function dateLabel(d: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d ?? ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(d ?? '');
}

interface InvoiceEmailLine { kind: string; description: string; amount: number; vatNumber?: string }

/**
 * The rent invoice email. Built from the invoice's own stored lines, so the
 * email and the invoice cannot disagree. "Tax invoice" only when VAT was
 * actually charged; a residential rent invoice is an ordinary invoice.
 */
function rentInvoiceEmail(p: Record<string, unknown>, brand: EmailBrand): EmailOptions | null {
  const items = Array.isArray(p.lines) ? (p.lines as InvoiceEmailLine[]) : null;
  if (!items || items.length === 0) return null;

  const tax = items.find((l) => l.kind === 'tax');
  const charges = items.filter((l) => l.kind !== 'tax');
  const subtotal = charges.reduce((s, l) => s + Number(l.amount), 0);
  const total = items.reduce((s, l) => s + Number(l.amount), 0);
  const period = periodLabel(p.period);
  const unit = String(p.unitLabel ?? '');
  const prop = String(p.propertyName ?? '');
  // Unit labels usually already lead with the building ("Masquerade Heights 204").
  const where = unit && prop && unit.startsWith(prop) ? unit : [prop, unit].filter(Boolean).join(', ');
  const rate = tax && subtotal > 0 ? Math.round((Number(tax.amount) / subtotal) * 100) : 0;

  const meta = [
    { label: 'Reference', value: String(p.reference ?? '') },
    { label: 'Period', value: period },
    { label: 'Issued', value: dateLabel(p.issuedOn) },
  ].filter((m) => m.value);

  const url = p.invoiceUrl ? String(p.invoiceUrl) : '';
  return {
    eyebrow: tax ? 'Tax invoice' : 'Invoice',
    preheader: `${zar(total)} due ${dateLabel(p.dueDate)} · ${period}`,
    heading: `Rent for ${period}`,
    paragraphs: [
      `Hi ${p.name || 'there'},`,
      `Here is your rent invoice${where ? ` for ${where}` : ''}.`,
    ],
    invoice: {
      amountDue: zar(total),
      dueLabel: `Due ${dateLabel(p.dueDate)}`,
      meta,
      // Stored descriptions carry the raw period ("Water 2026-11"); the email spells it out.
      lines: charges.map((l) => ({ description: String(l.description).replace(/\b\d{4}-\d{2}\b/, (m) => periodLabel(m)), amount: zar(l.amount) })),
      ...(tax ? { subtotal: zar(subtotal), vat: { label: `VAT (${rate}%)`, amount: zar(tax.amount) } } : {}),
      total: zar(total),
      ...(tax?.vatNumber ? { taxNote: `${brand.agencyName ?? ''} · VAT no. ${tax.vatNumber}`.replace(/^ · /, '') } : {}),
    },
    buttons: url ? [{ label: 'View invoice', url }] : [],
    footerNote: brand.contact?.email
      ? `Questions about this invoice? Email ${brand.contact.email}.`
      : undefined,
  };
}

export const TEMPLATES: Record<TemplateKey, Template> = {
  RENT_INVOICE_ISSUED: {
    key: 'RENT_INVOICE_ISSUED',
    defaultChannels: ['push', 'email'],
    subject: 'Rent invoice for {{period}}',
    body: 'Hi {{name}}, your rent invoice for {{period}} of {{currency}} {{amount}}{{vatBreakdown}} is due on {{dueDate}}.{{invoiceLink}}',
    email: {
      heading: 'Your rent invoice for {{period}}',
      paragraph: 'Hi {{name}}, your rent invoice for {{period}} of {{currency}} {{amount}}{{vatBreakdown}} is due on {{dueDate}}.',
      label: 'View your invoice',
      urlKey: 'invoiceUrl',
    },
    buildEmail: rentInvoiceEmail,
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
  const built = t.buildEmail?.(payload, brand) ?? null;
  if (built) {
    html = renderEmail({ ...brand, ...built });
  } else if (t.email) {
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
