import { AuthService } from '../src/modules/auth/auth.service';
import { hashOtp } from '../src/modules/auth/otp.util';

/**
 * Regression test for OTP brute-force: `attempts` used to be incremented but
 * never enforced, so a 6-digit code could be walked through by repeated calls.
 */
describe('OTP brute-force lockout', () => {
  const secret = process.env.JWT_SECRET ?? 'change-me-in-prod';
  const CODE = '123456';

  const makeService = (challenge: any) => {
    const otps: any = { findOne: jest.fn().mockResolvedValue(challenge), save: jest.fn(async (c: any) => c), create: jest.fn() };
    const user = { id: 'u1', email: 'a@b.test' };
    const users: any = { findOne: jest.fn().mockResolvedValue(user), save: jest.fn(async (u: any) => u), create: jest.fn(() => user) };
    const jwt: any = { sign: jest.fn().mockReturnValue('tok'), signAsync: jest.fn().mockResolvedValue('tok') };
    const ds: any = { query: jest.fn().mockResolvedValue([]) };
    return { svc: new AuthService(otps, users, jwt, ds), otps };
  };

  const challenge = (over: Partial<any> = {}) => ({
    id: 'c1', destination: 'a@b.test', codeHash: hashOtp(CODE, secret),
    expiresAt: new Date(Date.now() + 60_000), consumedAt: null, attempts: 0, createdAt: new Date(), ...over,
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const c = challenge();
    const { svc } = makeService(c);
    await expect(svc.verifyOtp('a@b.test', '000000')).rejects.toThrow(/invalid or expired/i);
    expect(c.attempts).toBe(1);
  });

  it('burns the challenge once the attempt limit is reached', async () => {
    const c = challenge({ attempts: 4 });
    const { svc } = makeService(c);
    await expect(svc.verifyOtp('a@b.test', '000000')).rejects.toThrow();
    expect(c.attempts).toBe(5);
    expect(c.consumedAt).toBeTruthy(); // burned, not reusable
  });

  it('refuses even the CORRECT code after the limit (no brute-force window)', async () => {
    const c = challenge({ attempts: 5 });
    const { svc } = makeService(c);
    await expect(svc.verifyOtp('a@b.test', CODE)).rejects.toThrow(/invalid or expired/i);
    expect(c.consumedAt).toBeTruthy();
  });

  it('still accepts the correct code within the limit', async () => {
    const c = challenge({ attempts: 2 });
    const { svc } = makeService(c);
    await expect(svc.verifyOtp('a@b.test', CODE)).resolves.toHaveProperty('accessToken');
  });
});
