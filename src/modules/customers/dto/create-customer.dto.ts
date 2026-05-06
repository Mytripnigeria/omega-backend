import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { CustomerSource } from '../entities/customer.entity';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Amaka' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional({ example: 'amaka@example.com', nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: '1995-04-12', nullable: true })
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'], nullable: true })
  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @ApiPropertyOptional({ example: 'Nigeria', nullable: true })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Lagos', nullable: true })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Lekki', nullable: true })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '12B Admiralty Way', nullable: true })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: '101245', nullable: true })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ enum: CustomerSource, default: CustomerSource.WALK_IN })
  @IsOptional()
  @IsEnum(CustomerSource)
  source?: CustomerSource;

  @ApiPropertyOptional({ type: [String], example: ['vip', 'newsletter'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  groups?: string[];

  @ApiPropertyOptional({ example: 'High-spending corporate customer' })
  @IsOptional()
  @IsString()
  notes?: string;
}
