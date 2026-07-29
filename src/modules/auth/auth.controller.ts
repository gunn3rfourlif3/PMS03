import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto } from './auth.dto';
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
    return this.auth.verifyOtp(dto.destination, dto.code);
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
  refresh(@CurrentTenant() principal: { userId: string; vendorId: string | null; roles: string[]; jti?: string }) {
    return this.auth.refresh(principal);
  }

  /** Sign out — instantly revokes this session server-side. */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentTenant() principal: { jti?: string }) {
    return this.auth.logout(principal.jti);
  }
}
