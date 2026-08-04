import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString() @IsNotEmpty() destination: string; // phone or email
}

export class VerifyOtpDto {
  @IsString() @IsNotEmpty() destination: string;
  @IsString() @Length(6, 6) code: string;
  /** Opt-in "remember this device" — returns a long-lived device token. */
  @IsOptional() @IsBoolean() remember?: boolean;
}

export class DeviceLoginDto {
  @IsString() @IsNotEmpty() deviceToken: string;
}
