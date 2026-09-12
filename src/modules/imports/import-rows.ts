import { EntitySpec, ImportField } from './import-fields';
import {
  isBlank, parseBoolean, parseChoice, parseDate, parseEmail, parseInteger, parseMoney, parsePhone, parseText,
} from './import-values';

/**
 * Turning a sheet into checked rows. Pure — no database, no side effects.
 *
 * Every problem is reported against a row number and a column label, because
 * the dry run's only job is to be a list somebody can act on. "Row 34: Start
 * date is ambiguous" is actionable; "import failed" is not.
 */

export interface RowIssue {
  field: string;
  label: string;
  message: string;
  /** Severity. A warning does not block the import; an error does. */
  level: 'error' | 'warning';
}

export interface ParsedRow {
  /** 1-based row number as it appears in the spreadsheet, header included. */
  rowNumber: number;
  values: Record<string, unknown>;
  /** The natural key for this row, or null when the key fields are unusable. */
  key: string | null;
  issues: RowIssue[];
}

export interface ParsedSheet {
  rows: ParsedRow[];
  /** Rows with at least one error. Nothing commits while this is non-empty. */
  errorCount: number;
  warningCount: number;
  /** Rows that were entirely blank and ignored rather than reported. */
  skippedBlank: number;
}

const coerce = (field: ImportField, raw: unknown) => {
  switch (field.type) {
    case 'money': case 'percent': return parseMoney(raw);
    case 'date': return parseDate(raw);
    case 'phone': return parsePhone(raw);
    case 'email': return parseEmail(raw);
    case 'integer': return parseInteger(raw);
    case 'boolean': return parseBoolean(raw);
    case 'choice': return parseChoice(raw, field.choices ?? []);
    default: return parseText(raw);
  }
};

/**
 * Rules that span more than one column, per entity.
 *
 * These are the ones a type check cannot catch and a human would notice
 * immediately — a tenant with no way to contact them, a lease that ends before
 * it starts. Kept here rather than scattered so the whole contract for an
 * entity is readable in one place.
 */
const CROSS_FIELD: Partial<Record<string, (v: Record<string, unknown>) => RowIssue[]>> = {
  tenants: (v) => {
    if (isBlank(v.email) && isBlank(v.phone)) {
      return [{ field: 'email', label: 'Email / Phone', level: 'error',
        message: 'a tenant needs an email address or a phone number — there is no way to reach this one' }];
    }
    return [];
  },
  leases: (v) => {
    const out: RowIssue[] = [];
    if (isBlank(v.tenantEmail) && isBlank(v.tenantName)) {
      out.push({ field: 'tenantEmail', label: 'Tenant', level: 'error',
        message: 'a lease needs a tenant email or name to attach to' });
    }
    if (typeof v.startDate === 'string' && typeof v.endDate === 'string' && v.endDate < v.startDate) {
      out.push({ field: 'endDate', label: 'End date', level: 'error',
        message: `ends (${v.endDate}) before it starts (${v.startDate})` });
    }
    if (typeof v.rentAmount === 'number' && v.rentAmount <= 0) {
      out.push({ field: 'rentAmount', label: 'Rent', level: 'warning',
        message: 'rent is zero or negative — correct on a rent-free period, wrong otherwise' });
    }
    if (typeof v.escalationPct === 'number' && v.escalationPct > 0 && v.escalationPct < 1) {
      out.push({ field: 'escalationPct', label: 'Escalation %', level: 'warning',
        message: `${v.escalationPct} looks like a fraction — 7% is entered as 7, not 0.07` });
    }
    if (typeof v.escalationMonth === 'number' && (v.escalationMonth < 1 || v.escalationMonth > 12)) {
      out.push({ field: 'escalationMonth', label: 'Escalation month', level: 'error',
        message: 'must be a month number from 1 to 12' });
    }
    return out;
  },
  owners: (v) => {
    if (typeof v.managementFeePct === 'number' && v.managementFeePct > 0 && v.managementFeePct < 1) {
      return [{ field: 'managementFeePct', label: 'Management fee %', level: 'warning',
        message: `${v.managementFeePct} looks like a fraction — 8.5% is entered as 8.5, not 0.085` }];
    }
    return [];
  },
  deposits: (v) => {
    if (typeof v.amount === 'number' && v.amount < 0) {
      return [{ field: 'amount', label: 'Deposit amount', level: 'error',
        message: 'a deposit cannot be negative' }];
    }
    return [];
  },
  opening_balances: (v) => {
    if (typeof v.balance === 'number' && v.balance === 0) {
      return [{ field: 'balance', label: 'Amount owing', level: 'warning',
        message: 'zero balance — this row posts nothing and can be removed' }];
    }
    return [];
  },
};

const blankRow = (row: unknown[]): boolean =>
  row.every((c) => c === null || c === undefined || (typeof c === 'string' && c.trim() === ''));

/** Natural key for a row: the key fields, lower-cased and joined. Null if incomplete. */
export function rowKey(spec: EntitySpec, values: Record<string, unknown>): string | null {
  const parts = spec.naturalKey.map((k) => values[k]);
  if (parts.some((p) => isBlank(p))) return null;
  return parts.map((p) => String(p).trim().toLowerCase()).join(' · ');
}

/**
 * Parse and check every row against the spec and the operator's mapping.
 *
 * @param headerRowNumber the spreadsheet row the headers are on (usually 1), so
 *   reported row numbers match what the operator sees in Excel.
 */
export function parseRows(
  spec: EntitySpec,
  mapping: Record<string, string>,
  rows: unknown[][],
  headerRowNumber = 1,
): ParsedSheet {
  const byField = new Map<string, number>();
  for (const [col, field] of Object.entries(mapping)) byField.set(field, Number(col));

  const out: ParsedRow[] = [];
  let skippedBlank = 0;
  const seen = new Map<string, number>();

  rows.forEach((raw, i) => {
    const rowNumber = headerRowNumber + 1 + i;
    if (blankRow(raw)) { skippedBlank += 1; return; }

    const values: Record<string, unknown> = {};
    const issues: RowIssue[] = [];

    for (const field of spec.fields) {
      const col = byField.get(field.key);
      const raws = col === undefined ? undefined : raw[col];

      if (isBlank(raws)) {
        if (field.required) {
          issues.push({
            field: field.key, label: field.label, level: 'error',
            message: col === undefined ? 'is required, and no column is mapped to it' : 'is required but empty',
          });
        }
        continue;
      }

      const res = coerce(field, raws);
      if (res.ok) values[field.key] = res.value;
      else issues.push({ field: field.key, label: field.label, level: 'error', message: res.error });
    }

    if (!issues.some((x) => x.level === 'error')) {
      issues.push(...(CROSS_FIELD[spec.entity]?.(values) ?? []));
    }

    const key = rowKey(spec, values);
    if (key) {
      const first = seen.get(key);
      if (first !== undefined) {
        issues.push({
          field: spec.naturalKey[0], label: spec.naturalKey.join(' + '), level: 'error',
          message: `duplicates row ${first} — both are "${key}". Two rows cannot describe the same ${spec.rowIs}.`,
        });
      } else {
        seen.set(key, rowNumber);
      }
    }

    out.push({ rowNumber, values, key, issues });
  });

  return {
    rows: out,
    errorCount: out.filter((r) => r.issues.some((i) => i.level === 'error')).length,
    warningCount: out.filter((r) => r.issues.some((i) => i.level === 'warning')).length,
    skippedBlank,
  };
}
