import {
  Injectable, UnauthorizedException, NotFoundException, Optional, Inject, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OtpChallenge } from '@modules/identity/otp-challenge.entity';
import { User } from '@modules/identity/user.entity';
import { JwtPayload } from './jwt-payload.interface';
import { randomUUID } from 'node:crypto';
import { generateOtpCode, hashOtp, verifyOtp, isExpired } from './otp.util';
import { SessionStore } from './session-store.service';
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
  /**
   * Idle session window (minutes). This is the access-token lifetime: it is
   * refreshed on genuine user activity via POST /auth/refresh, so a session that
   * sits idle longer than this expires and is rejected server-side.
   */
  private readonly idleMinutes = Math.max(1, Number(process.env.SESSION_IDLE_MINUTES ?? 10));

  /** Sign an access token whose expiry is the idle window. */
  private signToken(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload, { secret: this.secret, expiresIn: `${this.idleMinutes}m` });
  }

  constructor(
    @InjectRepository(OtpChallenge) private readonly otps: Repository<OtpChallenge>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly sessions: SessionStore,
    @Optional() @Inject(CHANNEL_PROVIDERS) private readonly channels?: Map<Channel, ChannelProvider>,
  ) {}

  private get idleSec(): number { return this.idleMinutes * 60; }

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

  async verifyOtp(destination: string, code: string): Promise<{ accessToken: string; idleMinutes: number }> {
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

    // Context resolution priority: platform admin (env allowlist) → partner
    // (partner_members) → vendor membership. This decides which layer the token
    // operates in; a user who is several things gets the highest-privilege context.
    let payload: JwtPayload;

    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    if (isEmail && adminEmails.includes(destination.toLowerCase())) {
      payload = { sub: user.id, vendorId: null, partnerId: null, roles: ['platform_admin'] };
    } else {
      // Guarded so a pre-migration API start can't break logins if the table is
      // not there yet.
      let pm: { partner_id: string } | undefined;
      try {
        [pm] = await this.dataSource.query(
          'SELECT partner_id FROM partner_members WHERE user_id = $1 LIMIT 1', [user.id],
        );
      } catch { pm = undefined; }
      if (pm?.partner_id) {
        payload = { sub: user.id, vendorId: null, partnerId: pm.partner_id, roles: ['partner'] };
      } else {
        // Resolve active vendor context via the RLS-safe SECURITY DEFINER function
        // (cross-tenant lookup by user_id). First membership for now.
        const memberships: Array<{ vendor_id: string; role: string }> =
          await this.dataSource.query('SELECT * FROM auth_memberships_for_user($1)', [user.id]);
        const active = memberships[0];
        payload = { sub: user.id, vendorId: active?.vendor_id ?? null, roles: active ? [active.role] : [] };
      }
    }
    // Register a revocable session and embed its id in the token.
    const jti = randomUUID();
    await this.sessions.create(jti, user.id, this.idleSec);
    return { accessToken: await this.signToken({ ...payload, jti }), idleMinutes: this.idleMinutes };
  }

  /**
   * Slide the session forward on activity: re-issue a token with the same claims
   * and a fresh idle-window expiry. Requires a still-valid token (JwtAuthGuard),
   * so a session idle past the window can't be refreshed — it's expired.
   */
  async refresh(principal: { userId: string; vendorId: string | null; roles: string[]; jti?: string }): Promise<{ accessToken: string; idleMinutes: number }> {
    // Keep the same session id and slide its TTL; upgrade legacy (no-jti) tokens.
    let jti = principal.jti;
    if (jti) await this.sessions.touch(jti, this.idleSec);
    else { jti = randomUUID(); await this.sessions.create(jti, principal.userId, this.idleSec); }
    const payload: JwtPayload = { sub: principal.userId, vendorId: principal.vendorId ?? null, roles: principal.roles ?? [], jti };
    return { accessToken: await this.signToken(payload), idleMinutes: this.idleMinutes };
  }

  /** Instantly revoke the caller's session (sign-out). */
  async logout(jti?: string): Promise<{ ok: true }> {
    if (jti) await this.sessions.revoke(jti);
    return { ok: true };
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
