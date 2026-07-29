import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';
import { SessionStore } from './session-store.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly sessions: SessionStore) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-prod',
    });
  }

  /**
   * Return value becomes req.user; RlsInterceptor reads vendorId from it.
   * A token whose session has been revoked or has idle-expired is rejected here,
   * so revocation takes effect on the very next request. Tokens minted before
   * sessions existed (no jti) are allowed through — they expire on their own soon.
   */
  async validate(payload: JwtPayload) {
    if (payload.jti && !(await this.sessions.exists(payload.jti))) {
      throw new UnauthorizedException('Session has ended');
    }
    return {
      userId: payload.sub,
      vendorId: payload.vendorId,
      roles: payload.roles ?? [],
      jti: payload.jti,
    };
  }
}
