import { generateApiKey, hashKey, parsePrefix, verifyKey } from '../src/modules/api-keys/api-key.util';

describe('api key util', () => {
  it('generates a well-formed key with matching hash + prefix', () => {
    const k = generateApiKey();
    expect(k.plaintext).toMatch(/^pms_[0-9a-f]{8}_[0-9a-f]{48}$/);
    expect(parsePrefix(k.plaintext)).toBe(k.prefix);
    expect(k.hash).toBe(hashKey(k.plaintext));
  });
  it('verifies a correct key and rejects a wrong one', () => {
    const k = generateApiKey();
    expect(verifyKey(k.plaintext, k.hash)).toBe(true);
    expect(verifyKey(k.plaintext + 'x', k.hash)).toBe(false);
  });
  it('rejects malformed keys', () => {
    expect(parsePrefix('not-a-key')).toBeNull();
    expect(parsePrefix(undefined)).toBeNull();
  });
});
