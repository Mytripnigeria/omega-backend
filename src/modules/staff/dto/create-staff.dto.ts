import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { EmploymentType, SalaryPeriod } from '../entities/staff.entity';

export class CreateStaffDto {
  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this staff member belongs to' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 'Amaka' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: 'amaka.okafor@mrjollof.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid phone number' })
  phone: string;

  @ApiProperty({ format: 'uuid', example: 'r1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Role assigned to this staff member' })
  @IsUUID()
  roleId: string;

  @ApiProperty({ enum: EmploymentType, example: EmploymentType.FULL_TIME })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiProperty({ example: 150000, description: 'Base salary in the smallest currency unit (kobo for NGN)' })
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @ApiProperty({ enum: SalaryPeriod, example: SalaryPeriod.MONTHLY })
  @IsEnum(SalaryPeriod)
  salaryPeriod: SalaryPeriod;

  @ApiProperty({ example: '2024-01-15', description: 'ISO 8601 date of hire' })
  @IsDateString()
  hireDate: string;

  @ApiPropertyOptional({ example: 'https://cdn.mrjollof.com/avatars/amaka.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: 'First Bank of Nigeria' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '3012345678', description: '10-digit NUBAN account number' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: '14 Bode Thomas Street, Surulere, Lagos' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Chukwu Okafor (Father)' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: '+2348098765432' })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;
}
