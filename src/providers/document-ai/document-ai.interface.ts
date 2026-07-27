/**
 * Document-AI abstraction for extracting structured lease data from raw text.
 * Provider-agnostic (heuristic stub for dev/CI, LLM providers for production),
 * mirroring the payment/notification/e-sign provider pattern.
 */
export interface LeaseExtraction {
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  tenantIdNumber?: string;
  leaseType?: 'fixed' | 'periodic';
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
  monthlyRent?: number;
  currency?: string;    // e.g. ZAR
  deposit?: number;
  dueDay?: number;      // 1-31
  escalationPct?: number;
  utilitiesIncluded?: string[];
  flaggedClauses?: string[];
  confidence?: number;  // 0..1 overall
  fieldConfidence?: Record<string, number>;
}

export interface DocumentAiProvider {
  readonly name: string;
  extractLease(text: string): Promise<LeaseExtraction>;
}

export const DOCUMENT_AI_PROVIDER = Symbol('DOCUMENT_AI_PROVIDER');

/** Coerce/validate an extraction: numbers, plausible dates, due-day range. */
export function sanitizeExtraction(e: LeaseExtraction): LeaseExtraction {
  const num = (v: any) => (v == null || v === '' ? undefined : Number(String(v).replace(/[^\d.]/g, '')) || undefined);
  const out: LeaseExtraction = { ...e };
  out.monthlyRent = num(e.monthlyRent);
  out.deposit = num(e.deposit);
  out.escalationPct = num(e.escalationPct);
  out.dueDay = e.dueDay != null ? Math.min(31, Math.max(1, Math.round(Number(e.dueDay)))) : undefined;
  out.startDate = normalizeDate(e.startDate);
  out.endDate = normalizeDate(e.endDate);
  // Drop an end date that isn't after the start date.
  if (out.startDate && out.endDate && out.endDate <= out.startDate) out.endDate = undefined;
  out.currency = e.currency || 'ZAR';
  out.utilitiesIncluded = Array.isArray(e.utilitiesIncluded) ? e.utilitiesIncluded : [];
  out.flaggedClauses = Array.isArray(e.flaggedClauses) ? e.flaggedClauses : [];
  return out;
}

/** Normalise dates to YYYY-MM-DD, treating slash/dash dates as SA DD/MM/YYYY. */
export function normalizeDate(s?: string): string | undefined {
  if (!s) return undefined;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    const dd = d.padStart(2, '0'), mm = mo.padStart(2, '0');
    if (Number(mm) > 12) return undefined;
    return `${y}-${mm}-${dd}`;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? undefined : dt.toISOString().slice(0, 10);
}
