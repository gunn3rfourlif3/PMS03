import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsOptional() @IsString() @MaxLength(40) type?: string; // 'agent' | 'demo' | 'contact'
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) company?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
}
