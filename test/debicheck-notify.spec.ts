import { renderTemplate, TEMPLATES } from '../src/modules/notifications/templates';
import { requiresTenantFallbackNotice } from '../src/modules/debicheck/consent-webhook';

const payload = {
  name: 'Thabo Mokoena',
  tenantName: 'Thabo Mokoena',
  propertyName: '12 Loop Street, Unit 4',
  currency: 'ZAR',
  amount: '8500.00',
  dueDate: 'day 1 of next month',
  state: 'cancelled',
  reasonSuffix: ' (CONTRACT_EXPIRED)',
  payUrl: 'https://app.locare.co.za',
  leaseUrl: 'https://app.locare.co.za/leases/abc',
};

describe('DEBIT_ORDER_STOPPED (tenant)', () => {
  const t = renderTemplate('DEBIT_ORDER_STOPPED', payload);

  it('says what happened and what to do, with the amount and date', () => {
    expect(t.body).toContain('Thabo Mokoena');
    expect(t.body).toContain('12 Loop Street, Unit 4');
    expect(t.body).toContain('ZAR 8500.00');
    expect(t.body).toContain('day 1 of next month');
    expect(t.body).toMatch(/pay it manually/i);
  });

  // A revocation is usually a bank action or an expired contract, not the
  // tenant dodging rent. Chasing a good tenant for an administrative event is
  // how an agency loses them.
  it('does not accuse the tenant or imply arrears', () => {
    const all = `${t.subject} ${t.body} ${t.html ?? ''}`.toLowerCase();
    for (const word of ['overdue', 'arrears', 'late fee', 'default', 'failed to pay', 'breach']) {
      expect(all).not.toContain(word);
    }
  });

  // Reassurance without using any of the blocked words above — a tenant reading
  // this has done nothing wrong and the copy has to say so plainly.
  it('reassures that the account is up to date', () => {
    expect((t.html ?? '').toLowerCase()).toContain('your account is up to date');
  });

  it('reaches a tenant who ignores email', () => {
    expect(TEMPLATES.DEBIT_ORDER_STOPPED.defaultChannels).toContain('sms');
  });

  it('renders a pay button from payUrl', () => {
    expect(t.html).toContain('https://app.locare.co.za');
    expect(t.html).toContain('Pay your rent');
  });

  it('leaves no unrendered placeholders', () => {
    expect(`${t.subject}${t.body}${t.html ?? ''}`).not.toMatch(/\{\{/);
  });
});

describe('DEBIT_ORDER_STOPPED_AGENCY (staff)', () => {
  const t = renderTemplate('DEBIT_ORDER_STOPPED_AGENCY', payload);

  it('names the tenant, property, state and reason', () => {
    expect(t.subject).toContain('Thabo Mokoena');
    expect(t.body).toContain('cancelled');
    expect(t.body).toContain('CONTRACT_EXPIRED');
  });

  it('says the tenant has already been told, so staff do not double up', () => {
    expect(t.body.toLowerCase()).toContain('pay manually');
  });

  it('reads cleanly when the provider gave no reason', () => {
    const noReason = renderTemplate('DEBIT_ORDER_STOPPED_AGENCY', { ...payload, reasonSuffix: '' });
    expect(noReason.body).toContain('moved to cancelled.');
    expect(noReason.body).not.toContain('  '); // no double space where the reason was
  });
});

describe('which transitions notify', () => {
  it.each(['cancelled', 'suspended', 'expired'] as const)('active → %s notifies', (to) => {
    expect(requiresTenantFallbackNotice('active', to)).toBe(true);
  });

  // Collection continues at the old ceiling during an amendment (§4), so
  // telling the tenant to pay manually here would be wrong and confusing.
  it('active → amending does not notify', () => {
    expect(requiresTenantFallbackNotice('active', 'amending')).toBe(false);
  });
});
