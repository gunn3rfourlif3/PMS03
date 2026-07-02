import {
  generateOtpCode, hashOtp, verifyOtp, isExpired,
} from '../src/modules/auth/otp.util';

describe('OTP util', () => {
  const secret = 'test-secret';

  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it('verifies a correct code and rejects a wrong one', () => {
    const code = '123456';
    const hash = hashOtp(code, secret);
    expect(verifyOtp('123456', hash, secret)).toBe(true);
    expect(verifyOtp('000000', hash, secret)).toBe(false);
  });

  it('does not verify under a different secret', () => {
    const hash = hashOtp('123456', secret);
    expect(verifyOtp('123456', hash, 'other-secret')).toBe(false);
  });

  it('detects expiry', () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isExpired(new Date(Date.now() + 10000))).toBe(false);
  });
});
