/**
 * Self-dealing detection — docs/LOCARE_COMMISSION_STRUCTURE.md §7.4.
 *
 * A partner earns no commission on an agency they control. Without this, an
 * agency principal can join the programme, refer themselves, and convert their
 * commission rate into a permanent discount on their own subscription — while
 * breaking no stated rule.
 *
 * Two strengths of signal, deliberately treated differently:
 *
 *   · `owner_email` is proof. The partner's contact address is the login of a
 *     vendor_owner on the referred agency: the same person on both sides. This
 *     blocks accrual.
 *   · everything else is a hint. Similar names and shared domains are common
 *     among legitimate partners — a franchise consultant and their client may
 *     share a surname or a mail domain. These are flagged for a human.
 *
 * Nothing here auto-terminates a partner. It withholds commission on one
 * agency and puts the pair in front of an admin.
 */

export type SelfDealingSignal = 'owner_email' | 'name_match' | 'email_domain' | 'phone_match';

export interface SelfDealingInput {
  partnerEmail?: string | null;
  partnerPhone?: string | null;
  partnerName?: string | null;
  partnerCompany?: string | null;
  /** Emails of every vendor_owner on the referred agency. */
  ownerEmails?: (string | null | undefined)[];
  ownerPhones?: (string | null | undefined)[];
  vendorName?: string | null;
}

export interface SelfDealingResult {
  signals: SelfDealingSignal[];
  /** True when the evidence is conclusive enough to withhold commission. */
  blocking: boolean;
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

/** Strip punctuation and company suffixes so "Dantalan (Pty) Ltd" ≈ "dantalan". */
function normCompany(s?: string | null): string {
  return norm(s)
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(pty|ltd|limited|inc|cc|properties|property|group|holdings|realty|rentals)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

const domain = (email?: string | null) => {
  const at = norm(email).lastIndexOf('@');
  return at === -1 ? '' : norm(email).slice(at + 1);
};

/** Free mail hosts prove nothing — half of SA small business runs on Gmail. */
const PUBLIC_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.za', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
  'webmail.co.za', 'mweb.co.za', 'telkomsa.net', 'vodamail.co.za',
]);

/** Last 9 digits — normalises 0821234567, +27821234567 and 27821234567. */
const phoneKey = (p?: string | null) => (p ?? '').replace(/\D/g, '').slice(-9);

export function selfDealingSignals(input: SelfDealingInput): SelfDealingResult {
  const signals: SelfDealingSignal[] = [];

  const partnerEmail = norm(input.partnerEmail);
  const ownerEmails = (input.ownerEmails ?? []).map(norm).filter(Boolean);

  if (partnerEmail && ownerEmails.includes(partnerEmail)) signals.push('owner_email');

  const pd = domain(partnerEmail);
  if (pd && !PUBLIC_MAIL.has(pd) && ownerEmails.some((e) => domain(e) === pd) && !signals.includes('owner_email')) {
    signals.push('email_domain');
  }

  const pk = phoneKey(input.partnerPhone);
  if (pk.length === 9 && (input.ownerPhones ?? []).some((p) => phoneKey(p) === pk)) {
    signals.push('phone_match');
  }

  const vendor = normCompany(input.vendorName);
  if (vendor) {
    for (const candidate of [input.partnerCompany, input.partnerName]) {
      const c = normCompany(candidate);
      if (c && c.length >= 4 && (c === vendor || c.includes(vendor) || vendor.includes(c))) {
        signals.push('name_match');
        break;
      }
    }
  }

  return { signals, blocking: signals.includes('owner_email') };
}

export const SIGNAL_LABELS: Record<SelfDealingSignal, string> = {
  owner_email: 'Partner contact email is an owner of the referred agency',
  email_domain: 'Partner and agency owner share a private mail domain',
  phone_match: 'Partner and agency owner share a phone number',
  name_match: 'Partner or their company name matches the agency name',
};
