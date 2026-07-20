import {
  Injectable, UnauthorizedException, NotFoundException, Optional, Inject, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OtpChallenge } from '@modules/identity/otp-challenge.entity';
import { User } from '@modules/identity/user.entity';
import { JwtPayload } from './jwt-payload.interface';
import { generateOtpCode, hashOtp, verifyOtp, isExpired } from './otp.util';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';

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
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  private readonly log = new Logger('OtpDelivery');

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
      // Expiry is configured on JwtModule.register (JWT_EXPIRES_IN, default 1h);
      // only the secret is passed here to stay within the typed sign options.
      accessToken: await this.jwt.signAsync(payload, { secret: this.secret }),
    };
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Dev delivery = console. Swap for an SMS/WhatsApp provider in prod. */
  /**
   * Deliver the OTP out-of-band. In dev (OTP_CHANNEL=console) it prints to the
   * server log. In production it is sent through the configured notification
   * channel — email (SendGrid) for an email destination, SMS (Twilio) otherwise
   * — so the code never touches the logs. Falls back to a log line if no channel
   * provider is wired, so the app never silently drops a login.
   */
  private async deliver(destination: string, code: string): Promise<void> {
    const channel = process.env.OTP_CHANNEL ?? 'console';
    const minutes = Math.round(this.ttl / 60);
    if (channel === 'console' || !this.channels) {
      this.log.log(`[OTP] ${destination} -> ${code}`);
      return;
    }
    const isEmail = destination.includes('@');
    const provider = this.channels.get(isEmail ? 'email' : 'sms');
    if (!provider) {
      this.log.warn(`No ${isEmail ? 'email' : 'sms'} provider configured — OTP not delivered to ${destination}`);
      return;
    }
    const res = await provider.send({
      to: destination,
      subject: 'Your sign-in code',
      body: `Your one-time sign-in code is ${code}. It expires in ${minutes} minute${minutes === 1 ? '' : 's'}. If you didn't request it, ignore this message.`,
    });
    if (!res.ok) this.log.error(`OTP delivery to ${destination} failed: ${res.error ?? 'unknown'}`);
  }
}
