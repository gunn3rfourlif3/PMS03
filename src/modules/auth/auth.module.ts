import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OtpChallenge } from '@modules/identity/otp-challenge.entity';
import { User } from '@modules/identity/user.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-prod',
      // Default expiry = the idle window (SESSION_IDLE_MINUTES, default 10m). The
      // auth service also sets this explicitly at sign time; kept in sync here so
      // any token minted through this module honours the same idle timeout.
      // Cast: the value is a runtime string, while the typings brand expiresIn as
      // a template-literal StringValue. '10m'/'1h'/'7d' etc. are valid.
      signOptions: { expiresIn: `${Math.max(1, Number(process.env.SESSION_IDLE_MINUTES ?? 10))}m` as JwtSignOptions['expiresIn'] },
    }),
    TypeOrmModule.forFeature([OtpChallenge, User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
