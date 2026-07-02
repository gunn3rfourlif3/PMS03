import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-prod',
    });
  }

  /** Return value becomes req.user; RlsInterceptor reads vendorId from it. */
  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      vendorId: payload.vendorId,
      roles: payload.roles ?? [],
    };
  }
}
