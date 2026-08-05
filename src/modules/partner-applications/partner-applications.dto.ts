import { IsArray, IsBoolean, IsEmail, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateApplicationDto {
  @IsIn(['individual', 'business']) type: 'individual' | 'business';
  @IsOptional() @IsString() contactName?: string;
  @IsEmail() contactEmail: string;
  @IsOptional() @IsString() contactPhone?: string;
  // Individual (KYC)
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsIn(['sa_id', 'passport']) idType?: 'sa_id' | 'passport';
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() residentialAddress?: string;
  // Business (KYB)
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() vatNumber?: string;
  @IsOptional() @IsString() businessAddress?: string;
  @IsOptional() @IsArray() directors?: Array<{ name?: string; idNumber?: string }>;
  // Payout banking
  @IsOptional() @IsObject() banking?: { bankName?: string; accountHolder?: string; accountNumber?: string; branchCode?: string; accountType?: string };
  @IsOptional() @IsBoolean() agreedTerms?: boolean;
}

export class UploadDocDto {
  @IsString() token: string;
  @IsOptional() @IsString() docType?: string;
}

export class SubmitDto {
  @IsString() token: string;
}

export class ApproveApplicationDto {
  @IsOptional() @IsNumber() commissionRate?: number;
  @IsOptional() @IsNumber() commissionMonths?: number;
}

export class DecisionDto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() note?: string;
}
