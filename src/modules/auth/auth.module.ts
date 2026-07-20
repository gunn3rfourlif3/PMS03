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
      // Cast: JWT_EXPIRES_IN is a runtime string, while the typings brand
      // expiresIn as a template-literal StringValue. '1h'/'30m'/'7d' etc. are valid.
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as JwtSignOptions['expiresIn'] },
    }),
    TypeOrmModule.forFeature([OtpChallenge, User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
