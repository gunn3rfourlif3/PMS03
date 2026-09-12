/**
 * What Locare needs, per entity, and what an agency's spreadsheet might call it.
 *
 * The `aliases` are the whole point of the column-mapping design: an agency
 * arrives with a sheet shaped by whatever they used before, and the operator
 * should find most columns already matched rather than picking twenty
 * dropdowns. Aliases are a head start, never a decision — every mapping is
 * shown and can be changed before anything is read.
 */

export type FieldType = 'text' | 'money' | 'percent' | 'date' | 'phone' | 'email' | 'integer' | 'boolean' | 'choice';

export interface ImportField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Shown in the template and the mapping screen. */
  example: string;
  /** Lower-case, punctuation-free forms an agency might use for this column. */
  aliases: string[];
  choices?: readonly string[];
  /** One line in the template explaining what we actually want. */
  note?: string;
}

export type ImportEntity =
  | 'owners' | 'properties' | 'units' | 'tenants' | 'leases' | 'deposits' | 'opening_balances';

export const DEPOSIT_HELD_BY = ['locare_trust', 'landlord', 'previous_agent', 'tpn_or_other'] as const;
export const LEASE_TYPES = ['fixed', 'month_to_month'] as const;

export interface EntitySpec {
  entity: ImportEntity;
  label: string;
  /** Plain-English description of one row. */
  rowIs: string;
  /** Fields forming the natural key — how a re-upload updates instead of duplicating. */
  naturalKey: string[];
  /** True where committing this entity posts to the ledger and cannot be undone by editing. */
  postsToLedger: boolean;
  fields: ImportField[];
}

export const ENTITIES: EntitySpec[] = [
  {
    entity: 'owners',
    label: 'Owners',
    rowIs: 'one landlord',
    naturalKey: ['name'],
    postsToLedger: false,
    fields: [
      { key: 'name', label: 'Owner name', type: 'text', required: true, example: 'M & J Property Trust', aliases: ['owner', 'ownername', 'landlord', 'landlordname', 'client', 'clientname'] },
      { key: 'email', label: 'Email', type: 'email', required: false, example: 'accounts@mjtrust.co.za', aliases: ['emailaddress', 'owneremail', 'landlordemail', 'contactemail'] },
      { key: 'phone', label: 'Phone', type: 'phone', required: false, example: '0821234567', aliases: ['cell', 'cellphone', 'mobile', 'telephone', 'tel', 'contactnumber', 'ownerphone'] },
      { key: 'managementFeePct', label: 'Management fee %', type: 'percent', required: false, example: '8.5', aliases: ['managementfee', 'commission', 'commissionpct', 'commissionpercentage', 'fee'], note: 'As a percentage, so 8.5 - not 0.085.' },
    ],
  },
  {
    entity: 'properties',
    label: 'Properties',
    rowIs: 'one building or house',
    naturalKey: ['name'],
    postsToLedger: false,
    fields: [
      { key: 'name', label: 'Property name', type: 'text', required: true, example: 'Grove Court', aliases: ['property', 'propertyname', 'building', 'buildingname', 'complex', 'scheme'] },
      { key: 'ownerName', label: 'Owner name', type: 'text', required: false, example: 'M & J Property Trust', aliases: ['owner', 'landlord', 'ownername', 'landlordname'], note: 'Must match an owner name exactly, or be imported in the owners file first.' },
      { key: 'addressLine', label: 'Street address', type: 'text', required: false, example: '14 Grove Road', aliases: ['address', 'streetaddress', 'physicaladdress', 'street', 'addressline1'] },
      { key: 'suburb', label: 'Suburb', type: 'text', required: false, example: 'Claremont', aliases: ['area', 'district'] },
      { key: 'city', label: 'City', type: 'text', required: false, example: 'Cape Town', aliases: ['town'] },
      { key: 'postalCode', label: 'Postal code', type: 'text', required: false, example: '7708', aliases: ['postcode', 'zip', 'zipcode'], note: 'Text, so a leading zero survives.' },
    ],
  },
  {
    entity: 'units',
    label: 'Units',
    rowIs: 'one lettable unit',
    naturalKey: ['propertyName', 'label'],
    postsToLedger: false,
    fields: [
      { key: 'propertyName', label: 'Property name', type: 'text', required: true, example: 'Grove Court', aliases: ['property', 'building', 'buildingname', 'complex', 'propertyname'] },
      { key: 'label', label: 'Unit number', type: 'text', required: true, example: '007', aliases: ['unit', 'unitno', 'unitnumber', 'door', 'doorno', 'flat', 'flatno', 'number'], note: 'Text, not a number - 007 must stay 007.' },
      { key: 'marketRent', label: 'Market rent', type: 'money', required: false, example: '9500', aliases: ['rent', 'rental', 'marketrental', 'askingrent', 'monthlyrent'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'integer', required: false, example: '2', aliases: ['beds', 'bed', 'noofbedrooms'] },
      { key: 'bathrooms', label: 'Bathrooms', type: 'integer', required: false, example: '1', aliases: ['baths', 'bath', 'noofbathrooms'] },
    ],
  },
  {
    entity: 'tenants',
    label: 'Tenants',
    rowIs: 'one tenant',
    naturalKey: ['email'],
    postsToLedger: false,
    fields: [
      { key: 'name', label: 'Tenant name', type: 'text', required: true, example: 'Thandi Mokoena', aliases: ['tenant', 'tenantname', 'fullname', 'occupant', 'lessee'] },
      { key: 'email', label: 'Email', type: 'email', required: false, example: 'thandi@example.co.za', aliases: ['emailaddress', 'tenantemail', 'contactemail'], note: 'Email or phone is required - one of the two must be present.' },
      { key: 'phone', label: 'Phone', type: 'phone', required: false, example: '0821234567', aliases: ['cell', 'cellphone', 'mobile', 'tel', 'telephone', 'contactnumber', 'tenantphone'] },
    ],
  },
  {
    entity: 'leases',
    label: 'Leases',
    rowIs: 'one lease on one unit',
    naturalKey: ['propertyName', 'unitLabel', 'startDate'],
    postsToLedger: false,
    fields: [
      { key: 'propertyName', label: 'Property name', type: 'text', required: true, example: 'Grove Court', aliases: ['property', 'building', 'complex', 'propertyname'] },
      { key: 'unitLabel', label: 'Unit number', type: 'text', required: true, example: '007', aliases: ['unit', 'unitno', 'unitnumber', 'door', 'flat', 'flatno'] },
      { key: 'tenantEmail', label: 'Tenant email', type: 'email', required: false, example: 'thandi@example.co.za', aliases: ['email', 'tenantemailaddress'], note: 'Email or name is required, to tie the lease to a tenant.' },
      { key: 'tenantName', label: 'Tenant name', type: 'text', required: false, example: 'Thandi Mokoena', aliases: ['tenant', 'lessee', 'occupant'] },
      { key: 'startDate', label: 'Start date', type: 'date', required: true, example: '2026-03-01', aliases: ['start', 'commencement', 'commencementdate', 'leasestart', 'from', 'datefrom'], note: 'YYYY-MM-DD is safest. 03/04/2026 is rejected as ambiguous.' },
      { key: 'endDate', label: 'End date', type: 'date', required: false, example: '2027-02-28', aliases: ['end', 'expiry', 'expirydate', 'leaseend', 'to', 'dateto', 'termination'] },
      { key: 'rentAmount', label: 'Rent', type: 'money', required: true, example: '9500', aliases: ['rent', 'rental', 'monthlyrent', 'rentpm', 'amount'] },
      { key: 'type', label: 'Lease type', type: 'choice', required: false, example: 'fixed', choices: LEASE_TYPES, aliases: ['leasetype', 'term', 'termtype'] },
      { key: 'escalationPct', label: 'Escalation %', type: 'percent', required: false, example: '7', aliases: ['escalation', 'escalationpercentage', 'increase', 'annualincrease', 'increasepct'], note: 'As a percentage, so 7 - not 0.07.' },
      { key: 'escalationMonth', label: 'Escalation month', type: 'integer', required: false, example: '3', aliases: ['escalationmonth', 'increasemonth', 'reviewmonth'], note: 'Month number the increase applies, 1-12.' },
    ],
  },
  {
    entity: 'deposits',
    label: 'Deposits held',
    rowIs: 'one deposit on one lease',
    naturalKey: ['propertyName', 'unitLabel'],
    postsToLedger: true,
    fields: [
      { key: 'propertyName', label: 'Property name', type: 'text', required: true, example: 'Grove Court', aliases: ['property', 'building', 'complex'] },
      { key: 'unitLabel', label: 'Unit number', type: 'text', required: true, example: '007', aliases: ['unit', 'unitno', 'door', 'flat'] },
      { key: 'amount', label: 'Deposit amount', type: 'money', required: true, example: '9500', aliases: ['deposit', 'depositamount', 'depositheld', 'securitydeposit'] },
      {
        key: 'heldBy', label: 'Held by', type: 'choice', required: true, example: 'locare_trust',
        choices: DEPOSIT_HELD_BY,
        aliases: ['heldin', 'heldwith', 'depositheldby', 'whoholds', 'location'],
        note: 'ONLY locare_trust posts to the trust ledger. If the landlord or the previous agent still holds the money, say so - recording it as trust money breaks the bank reconciliation.',
      },
      { key: 'interestAccrued', label: 'Interest accrued', type: 'money', required: false, example: '412.30', aliases: ['interest', 'interestearned', 'accruedinterest'] },
    ],
  },
  {
    entity: 'opening_balances',
    label: 'Arrears / opening balances',
    rowIs: 'what one tenant owes at go-live',
    naturalKey: ['propertyName', 'unitLabel'],
    postsToLedger: true,
    fields: [
      { key: 'propertyName', label: 'Property name', type: 'text', required: true, example: 'Grove Court', aliases: ['property', 'building', 'complex'] },
      { key: 'unitLabel', label: 'Unit number', type: 'text', required: true, example: '007', aliases: ['unit', 'unitno', 'door', 'flat'] },
      { key: 'balance', label: 'Amount owing', type: 'money', required: true, example: '18500', aliases: ['arrears', 'balance', 'owing', 'outstanding', 'amountdue', 'openingbalance'], note: 'Positive means the tenant owes. A credit is entered as a negative.' },
      { key: 'asAt', label: 'As at date', type: 'date', required: true, example: '2026-09-30', aliases: ['asat', 'asatdate', 'balancedate', 'date', 'statementdate'], note: 'The day the balance was struck - normally the day before go-live.' },
    ],
  },
];

export const entitySpec = (e: ImportEntity): EntitySpec => {
  const spec = ENTITIES.find((s) => s.entity === e);
  if (!spec) throw new Error(`Unknown import entity: ${e}`);
  return spec;
};

/** Normalise a spreadsheet header for comparison: lowercase, letters and digits. */
export const normaliseHeader = (h: string): string =>
  String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Best guess at which field a column is, or null.
 *
 * Exact match on the key, the label or an alias only - no fuzzy distance
 * scoring. A wrong automatic mapping is worse than an unmapped column, because
 * the operator scans for gaps and trusts what is already filled in.
 */
export function suggestField(header: string, spec: EntitySpec): string | null {
  const h = normaliseHeader(header);
  if (!h) return null;
  for (const f of spec.fields) {
    if (h === normaliseHeader(f.key) || h === normaliseHeader(f.label)) return f.key;
    if (f.aliases.some((a) => normaliseHeader(a) === h)) return f.key;
  }
  return null;
}

/** Suggest a whole mapping, never assigning the same field to two columns. */
export function suggestMapping(headers: string[], spec: EntitySpec): Record<number, string> {
  const out: Record<number, string> = {};
  const taken = new Set<string>();
  headers.forEach((h, i) => {
    const f = suggestField(h, spec);
    if (f && !taken.has(f)) { out[i] = f; taken.add(f); }
  });
  return out;
}

/**
 * The human label for a field key.
 *
 * Anything an agency reads must use these. The first template shipped saying
 * rows were matched on "propertyName + unitLabel + startDate", which is the
 * internal name of the column and means nothing to the person filling it in.
 */
export const fieldLabel = (spec: EntitySpec, key: string): string =>
  spec.fields.find((f) => f.key === key)?.label ?? key;

/** The natural key in words: "Property name + Unit number + Start date". */
export const naturalKeyLabels = (spec: EntitySpec): string =>
  spec.naturalKey.map((k) => fieldLabel(spec, k)).join(' + ');

/** What to call a type in a document a non-technical person reads. */
export const TYPE_LABEL: Record<FieldType, string> = {
  text: 'text',
  money: 'amount',
  percent: 'percentage',
  date: 'date',
  phone: 'phone number',
  email: 'email',
  integer: 'whole number',
  boolean: 'yes / no',
  choice: 'one of',
};
