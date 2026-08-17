import { StitchPaymentProvider, disbursementStatus } from '../src/providers/payment/stitch.provider';
import { toStitchBankId, toStitchAccountType, disbursementType } from '../src/providers/payment/stitch-banks';

describe('bank mapping', () => {
  it('prefers the branch code, which is unambiguous', () => {
    // Name says one bank, branch code says another — the code wins.
    expect(toStitchBankId('Standard Bank', '250655')).toBe('fnb');
  });

  it.each([
    ['FNB', 'fnb'], ['First National Bank', 'fnb'], ['  fnb  ', 'fnb'],
    ['Standard Bank', 'standardbank'], ['ABSA', 'absa'], ['Capitec Bank', 'capitec'],
    ['Nedbank', 'nedbank'], ['TymeBank', 'tymebank'], ['Discovery Bank', 'discovery_bank'],
  ])('maps free-text %s', (name, expected) => {
    expect(toStitchBankId(name)).toBe(expected);
  });

  // Guessing here would send an owner's money to the wrong bank id.
  it('returns undefined rather than guessing an unknown bank', () => {
    expect(toStitchBankId('Bank of Nowhere')).toBeUndefined();
    expect(toStitchBankId('')).toBeUndefined();
    expect(toStitchBankId(undefined, '000000')).toBeUndefined();
  });

  it('defaults a blank account type to current, the commonest business account', () => {
    expect(toStitchAccountType('')).toBe('current');
    expect(toStitchAccountType(undefined)).toBe('current');
    expect(toStitchAccountType('Savings')).toBe('savings');
    expect(toStitchAccountType('cheque')).toBe('current');
  });

  it('does not request INSTANT from a bank that cannot do it', () => {
    expect(disbursementType('fnb', true)).toBe('INSTANT');
    expect(disbursementType('grindrod_bank', true)).toBe('DEFAULT');
    expect(disbursementType('fnb', false)).toBe('DEFAULT');
  });
});

describe('disbursement status mapping', () => {
  it.each([
    ['DisbursementCompleted', 'paid'],
    ['DisbursementError', 'failed'],
    ['DisbursementCancelled', 'failed'],
    ['DisbursementReversed', 'failed'],
    ['DisbursementPending', 'scheduled'],
    ['DisbursementSubmitted', 'scheduled'],
    ['DisbursementPaused', 'scheduled'],
    [undefined, 'scheduled'],
  ])('%s → %s', (typename, expected) => {
    expect(disbursementStatus(typename as string)).toBe(expected);
  });
});

describe('StitchPaymentProvider.payout', () => {
  const base = {
    vendorId: 'v1', ownerId: 'o1', amount: 12500, currency: 'ZAR',
    idempotencyKey: 'stmt-2026-07-abc',
    bankAccount: { bankName: 'FNB', accountHolder: 'J Soap', accountNumber: '62012345678', branchCode: '250655', accountType: 'current' },
  };
  const env = { ...process.env };
  const arm = () => {
    process.env.STITCH_LIVE = 'true';
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
  };
  afterEach(() => { process.env = { ...env }; jest.restoreAllMocks(); });

  // The defect this guards: without a stable nonce, a retried timeout pays twice.
  it('refuses to pay without an idempotency key', async () => {
    arm();
    await expect(new StitchPaymentProvider().payout({ ...base, idempotencyKey: undefined }))
      .rejects.toThrow(/idempotencyKey is required/i);
  });

  it('refuses an unmappable bank rather than sending money somewhere', async () => {
    arm();
    await expect(new StitchPaymentProvider().payout({
      ...base, bankAccount: { ...base.bankAccount, bankName: 'Bank of Nowhere', branchCode: '' },
    })).rejects.toThrow(/Cannot map/i);
  });

  it('refuses when not configured, instead of reporting scheduled', async () => {
    delete process.env.STITCH_LIVE;
    await expect(new StitchPaymentProvider().payout(base)).rejects.toThrow(/not configured/i);
  });

  it('creates a disbursement and passes the statement id as the nonce', async () => {
    arm();
    const calls: any[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => ({ data: { clientDisbursementCreate: { disbursement: { id: 'dis-1', status: { __typename: 'DisbursementPending' } } } } }) } as any;
    });

    const r = await new StitchPaymentProvider().payout(base);

    expect(r).toEqual({ providerRef: 'dis-1', status: 'scheduled' });
    expect(calls[0].init.body).toContain('scope=client_disbursement');
    const vars = JSON.parse(calls[1].init.body).variables;
    expect(vars.nonce).toBe('stmt-2026-07-abc');
    expect(vars.bankId).toBe('fnb');
    expect(vars.amount).toEqual({ quantity: 12500, currency: 'ZAR' });
    expect(vars.beneficiaryReference.length).toBeLessThanOrEqual(20);
  });

  // Retrying a timed-out payout hits a duplicate nonce. That is the mechanism
  // working, not a failure — the money is already on its way.
  it('treats a duplicate nonce as already scheduled, not as a failure', async () => {
    arm();
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => ({ errors: [{ message: 'A disbursement with this nonce already exists' }] }) } as any;
    });

    const r = await new StitchPaymentProvider().payout(base);
    expect(r.status).toBe('scheduled');
  });

  it('reports a genuine API error as failed', async () => {
    arm();
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => ({ errors: [{ message: 'account_verification_failed_cdv' }] }) } as any;
    });

    expect((await new StitchPaymentProvider().payout(base)).status).toBe('failed');
  });
});
