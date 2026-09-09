import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { LEAD_SOURCES } from '@common/lead-sources';

export class CreateLeadDto {
  @IsOptional() @IsString() @MaxLength(40) type?: string; // 'agent' | 'demo' | 'contact'
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) company?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  /** "Where did you hear about us?" — constrained so the column stays groupable. */
  @IsOptional() @IsIn(LEAD_SOURCES as unknown as string[]) source?: string;
}
