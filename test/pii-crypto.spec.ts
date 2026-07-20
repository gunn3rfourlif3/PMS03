import { encryptJson, decryptJson, encryptedJson, maskBanking } from '../src/common/security/pii-crypto';

describe('PII crypto (AES-256-GCM)', () => {
  const banking = { bankName: 'FNB', accountHolder: 'A Jones', accountNumber: '62012345678', branchCode: '250655' };

  it('round-trips an encrypted value', () => {
    const env = encryptJson(banking);
    expect(env.__enc).toBe(1);
    expect(typeof env.ct).toBe('string');
    expect(JSON.stringify(env)).not.toContain('62012345678'); // ciphertext, not plaintext
    expect(decryptJson(env)).toEqual(banking);
  });

  it('produces a fresh IV each time (non-deterministic ciphertext)', () => {
    expect(encryptJson(banking).ct).not.toBe(encryptJson(banking).ct);
  });

  it('transformer encrypts on write and decrypts on read', () => {
    const stored = encryptedJson.to(banking) as any;
    expect(stored.__enc).toBe(1);
    expect(encryptedJson.from(stored)).toEqual(banking);
  });

  it('transformer reads legacy plaintext transparently', () => {
    expect(encryptedJson.from(banking)).toEqual(banking); // not an envelope -> passthrough
    expect(encryptedJson.from(null)).toEqual({});
  });

  it('fails to decrypt tampered ciphertext (auth tag)', () => {
    const env = encryptJson(banking);
    expect(() => decryptJson({ ...env, ct: Buffer.from('tampered').toString('base64') })).toThrow();
  });
});

describe('maskBanking', () => {
  it('redacts the account number to last 4', () => {
    const m = maskBanking({ bankName: 'FNB', accountNumber: '62012345678' }) as any;
    expect(m.accountNumber).toBe('••••5678');
    expect(m.accountNumberLast4).toBe('5678');
    expect(m.bankName).toBe('FNB');
  });
  it('is a no-op when there is no account number', () => {
    expect(maskBanking({})).toEqual({});
    expect(maskBanking(null)).toEqual({});
  });
});
