import {
  Injectable, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException, Optional, Inject, Logger,
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
import { GoogleOAuthService, GoogleIdentity } from './google-oauth.service';
import { decideGoogleLink } from './google-link';
import { CHANNEL_PROVIDERS, ChannelProvider, Channel } from '@providers/notification/notification-provider.interface';
import { cascadeSend, parseChannels } from '@providers/notification/cascade';
import { toE164 } from '@common/phone/e164';

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
  /**
   * "Remember this device" lifetime (days). A returning user on a trusted device
   * re-auths WITHOUT a fresh OTP — so we don't pay for a WhatsApp/SMS code every
   * login. 0 disables the feature.
   */
  private readonly trustedDeviceDays = Math.max(0, Number(process.env.TRUSTED_DEVICE_DAYS ?? 30));
  private get trustedDeviceSec(): number { return this.trustedDeviceDays * 86400; }

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
    private readonly google: GoogleOAuthService,
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

  async verifyOtp(
    destination: string,
    code: string,
    opts?: { remember?: boolean },
  ): Promise<{ accessToken: string; idleMinutes: number; deviceToken?: string; trustedDays?: number }> {
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

    // Upsert the user by phone/email. Phones are stored/looked-up in E.164 so a
    // number typed as "082…" matches the canonical "+2782…" on record.
    const isEmail = destination.includes('@');
    const phone = isEmail ? undefined : (toE164(destination) ?? destination);
    let user = await this.users.findOne({
      where: isEmail ? { email: destination } : { phone },
    });
    if (!user) {
      user = await this.users.save(
        this.users.create(isEmail ? { email: destination } : { phone }),
      );
    }

    const session = await this.issueForUser(user);
    // "Remember this device" — hand back a long-lived token the client stores so
    // its next launch re-auths without another (paid) OTP.
    if (opts?.remember && this.trustedDeviceSec > 0) {
      const deviceToken = await this.sessions.createDevice(user.id, this.trustedDeviceSec);
      return { ...session, deviceToken, trustedDays: this.trustedDeviceDays };
    }
    return session;
  }

  /**
   * Passwordless re-auth from a trusted device: exchange a remembered device
   * token for a fresh session WITHOUT sending a new OTP. The presented token is
   * rotated (single-use) so a captured token can't be replayed. Throws if the
   * token is unknown/expired, or if the account is gated (pending lease).
   */
  async deviceLogin(deviceToken: string): Promise<{ accessToken: string; idleMinutes: number; deviceToken: string; trustedDays: number }> {
    if (this.trustedDeviceSec <= 0) throw new UnauthorizedException('Trusted devices are disabled');
    const rotated = await this.sessions.rotateDevice(deviceToken, this.trustedDeviceSec);
    if (!rotated) throw new UnauthorizedException('Device not recognised — please sign in again');
    const user = await this.users.findOne({ where: { id: rotated.userId } });
    if (!user) {
      await this.sessions.revokeDevice(rotated.token);
      throw new UnauthorizedException('Device not recognised — please sign in again');
    }
    try {
      const session = await this.issueForUser(user);
      return { ...session, deviceToken: rotated.token, trustedDays: this.trustedDeviceDays };
    } catch (e) {
      await this.sessions.revokeDevice(rotated.token); // don't orphan a token we can't use
      throw e;
    }
  }

  /** Forget a trusted device (called on explicit sign-out). Best-effort. */
  async forgetDevice(deviceToken?: string): Promise<void> {
    if (deviceToken) await this.sessions.revokeDevice(deviceToken).catch(() => undefined);
  }

  /**
   * Resolve a user's context and mint a revocable session token. Context priority:
   * platform admin (env allowlist) → partner (partner_members) → vendor membership.
   * Shared by OTP and Google sign-in. Throws if the only membership is 'pending'
   * (approved applicant who hasn't signed their lease).
   */
  async issueForUser(user: User): Promise<{ accessToken: string; idleMinutes: number }> {
    const email = (user.email ?? '').toLowerCase();
    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    let payload: JwtPayload;
    if (email && adminEmails.includes(email)) {
      payload = { sub: user.id, vendorId: null, partnerId: null, roles: ['platform_admin'] };
    } else {
      let pm: { partner_id: string } | undefined;
      try {
        [pm] = await this.dataSource.query('SELECT partner_id FROM partner_members WHERE user_id = $1 LIMIT 1', [user.id]);
      } catch { pm = undefined; }
      if (pm?.partner_id) {
        payload = { sub: user.id, vendorId: null, partnerId: pm.partner_id, roles: ['partner'] };
      } else {
        const memberships: Array<{ vendor_id: string; role: string }> =
          await this.dataSource.query('SELECT * FROM auth_memberships_for_user($1)', [user.id]);
        const active = memberships[0];
        if (!active) {
          let pending = false;
          try {
            const [row] = await this.dataSource.query('SELECT auth_has_pending_membership($1) AS p', [user.id]);
            pending = !!row?.p;
          } catch { pending = false; }
          if (pending) {
            throw new ForbiddenException(
              'Please sign your lease agreement first. Your account is activated as soon as your lease is signed — check your email for the signing link.',
            );
          }
        }
        payload = { sub: user.id, vendorId: active?.vendor_id ?? null, roles: active ? [active.role] : [] };
      }
    }
    const jti = randomUUID();
    await this.sessions.create(jti, user.id, this.idleSec);
    return { accessToken: await this.signToken({ ...payload, jti }), idleMinutes: this.idleMinutes };
  }

  // ── Google (social) sign-in ──────────────────────────────────────────────

  googleEnabled(): { enabled: boolean } {
    return { enabled: this.google.enabled };
  }

  /** Consent URL, embedding a signed state that carries the origin to return to. */
  googleStartUrl(origin: string): string {
    if (!this.google.enabled) throw new BadRequestException('Google sign-in is not enabled.');
    const o = this.allowedOrigin(origin);
    const state = this.jwt.sign({ o, n: randomUUID(), k: 'google' }, { secret: this.secret, expiresIn: '10m' });
    return this.google.authorizeUrl(state);
  }

  /** Handle Google's redirect. Always returns a browser redirect URL — a success
   *  carries a one-time code, a failure carries an error message. */
  async googleCallback(code: string, state: string): Promise<string> {
    let claims: any;
    try { claims = this.jwt.verify(state, { secret: this.secret }); }
    catch { throw new BadRequestException('Your sign-in link is invalid or has expired.'); }
    const origin = this.allowedOrigin(claims?.o);
    try {
      if (!code) throw new BadRequestException('Google sign-in was cancelled.');
      const id = await this.google.exchangeCode(code);
      const user = await this.linkGoogleUser(id);
      const { accessToken } = await this.issueForUser(user);
      const otc = randomUUID();
      await this.sessions.putCode(otc, accessToken, 120);
      return `${origin}/auth/google/return?otc=${encodeURIComponent(otc)}`;
    } catch (e: any) {
      const msg = e?.message ?? 'Google sign-in failed.';
      return `${origin}/auth/google/return?error=${encodeURIComponent(msg)}`;
    }
  }

  /** Exchange the one-time return code for the access token (single use). */
  async exchangeGoogleCode(otc: string): Promise<{ accessToken: string; idleMinutes: number }> {
    const token = otc ? await this.sessions.takeCode(otc) : null;
    if (!token) throw new UnauthorizedException('This sign-in link has expired. Please sign in again.');
    return { accessToken: token, idleMinutes: this.idleMinutes };
  }

  // ── Platform-admin "sign in as agency" (support impersonation) ────────────

  /** Every active vendor, for the admin agencies picker (vendors is FORCE-RLS). */
  listAgencies(): Promise<Array<{ vendorId: string; name: string; slug: string; status: string }>> {
    return this.dataSource.query('SELECT * FROM platform_agencies()');
  }

  /** Paged impersonation audit log (platform admin). */
  impersonationEvents(limit = 100): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT id, admin_email AS "adminEmail", vendor_name AS "agency", reason, ip,
              started_at AS "startedAt", ended_at AS "endedAt"
       FROM impersonation_events ORDER BY started_at DESC LIMIT $1`,
      [Math.min(500, Math.max(1, limit))],
    );
  }

  /** Mint an agency-scoped token for a platform admin, audited + time-boxed. */
  async impersonate(
    admin: { userId: string; roles: string[]; act?: unknown },
    vendorId: string,
    reason: string | undefined,
    ip?: string,
  ): Promise<{ accessToken: string; idleMinutes: number; agency: { id: string; name: string } }> {
    if (admin.act) throw new BadRequestException('Already impersonating — exit first.');
    if (!vendorId) throw new BadRequestException('An agency is required.');

    const [target] = await this.dataSource.query('SELECT * FROM impersonation_target($1)', [vendorId]);
    if (!target) throw new NotFoundException('Agency not found.');
    if (target.status !== 'active') throw new BadRequestException('That agency is not active.');

    const adminUser = await this.users.findOne({ where: { id: admin.userId } });
    const adminEmail = adminUser?.email ?? '';

    const [ev] = await this.dataSource.query(
      `INSERT INTO impersonation_events (admin_user_id, admin_email, vendor_id, vendor_name, reason, ip)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [admin.userId, adminEmail, vendorId, target.name, reason ?? null, ip ?? null],
    );

    const jti = randomUUID();
    await this.sessions.create(jti, admin.userId, this.idleSec);
    const payload: JwtPayload = {
      sub: admin.userId,
      vendorId,
      roles: ['property_manager'],
      act: { id: admin.userId, email: adminEmail, ev: ev.id, agency: target.name },
      jti,
    };
    return {
      accessToken: await this.signToken(payload),
      idleMinutes: this.idleMinutes,
      agency: { id: vendorId, name: target.name },
    };
  }

  /** End impersonation: revoke the session, stamp the audit row, return to admin. */
  async stopImpersonation(principal: { userId: string; jti?: string; act?: { ev?: string } | null }): Promise<{ accessToken: string; idleMinutes: number }> {
    if (!principal.act) throw new BadRequestException('Not currently impersonating.');
    if (principal.jti) await this.sessions.revoke(principal.jti);
    if (principal.act.ev) {
      await this.dataSource.query(
        `UPDATE impersonation_events SET ended_at = now() WHERE id = $1 AND ended_at IS NULL`,
        [principal.act.ev],
      );
    }
    const adminUser = await this.users.findOne({ where: { id: principal.userId } });
    if (!adminUser) throw new UnauthorizedException('Session ended.');
    return this.issueForUser(adminUser);
  }

  /** Find-or-link a user for a verified Google identity (see design §4). */
  private async linkGoogleUser(id: GoogleIdentity): Promise<User> {
    const bySub = await this.users.findOne({ where: { googleSub: id.sub } });
    const byEmail = bySub ? null : await this.users.findOne({ where: { email: id.email } });
    switch (decideGoogleLink(!!bySub, byEmail, id.sub)) {
      case 'use':
        return bySub!;
      case 'conflict':
        throw new ForbiddenException('This email is linked to a different Google account.');
      case 'link':
        byEmail!.googleSub = id.sub;
        if (!byEmail!.name && id.name) byEmail!.name = id.name;
        return this.users.save(byEmail!);
      case 'create':
      default:
        return this.users.save(this.users.create({ email: id.email, googleSub: id.sub, name: id.name }));
    }
  }

  /** Only return to a known front-end origin (prevents open redirects). */
  private allowedOrigin(origin?: string): string {
    const list = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (origin && list.includes(origin)) return origin;
    return list[0] ?? (process.env.AUTH_BASE ?? '').replace(/\/+$/, '');
  }

  /**
   * Slide the session forward on activity: re-issue a token with the same claims
   * and a fresh idle-window expiry. Requires a still-valid token (JwtAuthGuard),
   * so a session idle past the window can't be refreshed — it's expired.
   */
  async refresh(principal: {
    userId: string; vendorId: string | null; roles: string[]; jti?: string;
    partnerId?: string | null; act?: JwtPayload['act'] | null;
  }): Promise<{ accessToken: string; idleMinutes: number }> {
    // Keep the same session id and slide its TTL; upgrade legacy (no-jti) tokens.
    let jti = principal.jti;
    if (jti) await this.sessions.touch(jti, this.idleSec);
    else { jti = randomUUID(); await this.sessions.create(jti, principal.userId, this.idleSec); }
    // Preserve the FULL identity, not just roles — a refreshed partner token must
    // keep partnerId, and an impersonation token must keep its act claim.
    const payload: JwtPayload = {
      sub: principal.userId,
      vendorId: principal.vendorId ?? null,
      roles: principal.roles ?? [],
      ...(principal.partnerId ? { partnerId: principal.partnerId } : {}),
      ...(principal.act ? { act: principal.act } : {}),
      jti,
    };
    return { accessToken: await this.signToken(payload), idleMinutes: this.idleMinutes };
  }

  /** Instantly revoke the caller's session (sign-out). */
  async logout(jti?: string, deviceToken?: string): Promise<{ ok: true }> {
    if (jti) await this.sessions.revoke(jti);
    await this.forgetDevice(deviceToken);
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
    // OTP_CHANNELS is an ordered cascade (default whatsapp,email); the legacy
    // OTP_CHANNEL is still honoured, and 'console' prints to the log for dev.
    const raw = process.env.OTP_CHANNELS ?? process.env.OTP_CHANNEL ?? 'console';
    const minutes = Math.round(this.ttl / 60);
    if (raw === 'console' || !this.channels) {
      this.log.log(`[OTP] ${destination} -> ${code}`);
      return;
    }
    const order = parseChannels(raw, ['whatsapp', 'email']);
    const isEmail = destination.includes('@');
    const contacts = {
      email: isEmail ? destination : null,
      phone: isEmail ? null : toE164(destination),
    };
    const waTemplate = process.env.WHATSAPP_OTP_TEMPLATE ?? 'locare_otp';
    const body = `Your one-time sign-in code is ${code}. It expires in ${minutes} minute${minutes === 1 ? '' : 's'}. If you didn't request it, ignore this message.`;

    const result = await cascadeSend(this.channels, order, contacts, (channel, to) => ({
      to,
      subject: 'Your sign-in code',
      body,
      ...(channel === 'whatsapp'
        ? { template: { name: waTemplate, vars: [code], kind: 'auth' as const } }
        : {}),
    }));

    if (!result) this.log.error(`OTP delivery to ${destination} failed on all channels (${order.join(',')})`);
    else this.log.log(`OTP to ${destination} delivered via ${result.channel}`);
  }
}
