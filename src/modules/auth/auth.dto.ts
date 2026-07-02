import { IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString() @IsNotEmpty() destination: string; // phone or email
}

export class VerifyOtpDto {
  @IsString() @IsNotEmpty() destination: string;
  @IsString() @Length(6, 6) code: string;
}
