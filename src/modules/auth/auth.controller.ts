import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto, DeviceLoginDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentTenant } from './current-tenant.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Auth endpoints are far more aggressively rate-limited than the global
  // default (120/min): OTP issuance and verification are brute-force targets.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  request(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.destination);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.destination, dto.code, { remember: dto.remember });
  }

  /**
   * Trusted-device re-auth: exchange a remembered device token for a fresh
   * session without a new OTP. Rate-limited; the token is rotated on each use.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('device/login')
  deviceLogin(@Body() dto: DeviceLoginDto) {
    return this.auth.deviceLogin(dto.deviceToken);
  }

  // ── Google (social) sign-in ──
  /** Is Google login configured/enabled? (Drives whether the button shows.) */
  @Get('google/enabled')
  googleEnabled() {
    return this.auth.googleEnabled();
  }

  /** Full-page redirect to Google's consent screen; `origin` is where to return. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google/start')
  googleStart(@Query('origin') origin: string, @Res() res: Response) {
    res.redirect(this.auth.googleStartUrl(origin));
  }

  /** Google's redirect target (the one registered URI). Verifies + redirects back. */
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    res.redirect(await this.auth.googleCallback(code, state));
  }

  /** The return page exchanges its one-time code for the access token. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('google/exchange')
  googleExchange(@Body() body: { otc: string }) {
    return this.auth.exchangeGoogleCode(body?.otc);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentTenant() principal: { userId: string }) {
    return this.auth.me(principal.userId);
  }

  /**
   * Slide the idle session on genuine user activity. Clients call this (throttled)
   * while the user is interacting; it needs a still-valid token, so an idle
   * session past the window can't be refreshed and is enforced as expired.
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  refresh(@CurrentTenant() principal: {
    userId: string; vendorId: string | null; roles: string[]; jti?: string;
    partnerId?: string | null; act?: { id: string; email: string; ev: string; agency: string } | null;
  }) {
    return this.auth.refresh(principal);
  }

  /** Sign out — instantly revokes this session server-side and forgets the device. */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentTenant() principal: { jti?: string }, @Body() body?: { deviceToken?: string }) {
    return this.auth.logout(principal.jti, body?.deviceToken);
  }

  /** End an impersonation session and return to the platform-admin context. */
  @UseGuards(JwtAuthGuard)
  @Post('impersonate/stop')
  stopImpersonation(@CurrentTenant() principal: { userId: string; jti?: string; act?: { ev?: string } | null }) {
    return this.auth.stopImpersonation(principal);
  }
}
