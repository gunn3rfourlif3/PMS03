import {
  Injectable, UnauthorizedException, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OtpChallenge } from '@modules/identity/otp-challenge.entity';
import { User } from '@modules/identity/user.entity';
import { JwtPayload } from './jwt-payload.interface';
import { generateOtpCode, hashOtp, verifyOtp, isExpired } from './otp.util';

/**
 * Passwordless OTP auth.
 *
 * requestOtp: create a short-lived challenge, deliver the code out-of-band
 *   (SMS/WhatsApp in prod; console in dev). Only the HMAC is stored.
 * verifyOtp: validate the code, upsert the user, resolve their membership,
 *   and issue a JWT carrying { sub, vendorId, roles }.
 *
 * NOTE: these queries run pre-auth (no tenant context yet), so they use the
 * root DataSource repositories directly. Once authenticated, all other requests
 * flow through the RLS interceptor.
 */
@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET ?? 'change-me-in-prod';
  private readonly ttl = Number(process.env.OTP_TTL_SECONDS ?? 300);
  /** Max wrong guesses before a challenge is burned (anti brute-force). */
  private readonly maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

  constructor(
    @InjectRepository(OtpChallenge) private readonly otps: Repository<OtpChallenge>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async requestOtp(destination: string): Promise<{ sent: true }> {
    const code = generateOtpCode();
    const challenge = this.otps.create({
      destination,
      codeHash: hashOtp(code, this.secret),
      expiresAt: new Date(Date.now() + this.ttl * 1000),
    });
    await this.otps.save(challenge);
    await this.deliver(destination, code);
    return { sent: true };
  }

  async verifyOtp(destination: string, code: string): Promise<{ accessToken: string }> {
    const challenge = await this.otps.findOne({
      where: { destination },
      order: { createdAt: 'DESC' },
    });
    if (!challenge || challenge.consumedAt || isExpired(challenge.expiresAt)) {
      throw new UnauthorizedException('OTP invalid or expired');
    }
    // Anti brute-force: a challenge is burned after too many wrong guesses, so a
    // 6-digit code can't be walked through by repeated requests.
    if (challenge.attempts >= this.maxAttempts) {
      challenge.consumedAt = new Date();
      await this.otps.save(challenge);
      throw new UnauthorizedException('OTP invalid or expired');
    }
    if (!verifyOtp(code, challenge.codeHash, this.secret)) {
      challenge.attempts += 1;
      if (challenge.attempts >= this.maxAttempts) challenge.consumedAt = new Date();
      await this.otps.save(challenge);
      throw new UnauthorizedException('OTP invalid or expired');
    }
    challenge.consumedAt = new Date();
    await this.otps.save(challenge);

    // Upsert the user by phone/email.
    const isEmail = destination.includes('@');
    let user = await this.users.findOne({
      where: isEmail ? { email: destination } : { phone: destination },
    });
    if (!user) {
      user = await this.users.save(
        this.users.create(isEmail ? { email: destination } : { phone: destination }),
      );
    }

    // Resolve active vendor context via the RLS-safe SECURITY DEFINER function
    // (cross-tenant lookup by user_id, which plain RLS-scoped access can't do).
    // First membership for now; a later phase adds vendor-switch for multi-vendor
    // users. Returns [] for a brand-new user with no membership yet.
    const memberships: Array<{ vendor_id: string; role: string }> =
      await this.dataSource.query('SELECT * FROM auth_memberships_for_user($1)', [
        user.id,
      ]);
    const active = memberships[0];

    const payload: JwtPayload = {
      sub: user.id,
      vendorId: active?.vendor_id ?? null,
      roles: active ? [active.role] : [],
    };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.secret,
        expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
      }),
    };
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Dev delivery = console. Swap for an SMS/WhatsApp provider in prod. */
  private async deliver(destination: string, code: string): Promise<void> {
    if ((process.env.OTP_CHANNEL ?? 'console') === 'console') {
      // eslint-disable-next-line no-console
      console.log(`[OTP] ${destination} -> ${code}`);
    }
    // TODO: integrate SMS/WhatsApp provider (e.g. via NotificationsModule).
  }
}
