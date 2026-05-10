import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CustomerAddressEntity } from '../entities/customer-address.entity';

export class CreateCustomerAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(1)
  label: string;

  @ApiProperty({ example: '15 Admiralty Way' })
  @IsString()
  @MinLength(1)
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiPropertyOptional({ example: 'Lekki' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto extends PartialType(
  CreateCustomerAddressDto,
) {}

export class CustomerAddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  customerId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  label: string;

  @ApiProperty()
  @Expose()
  line1: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  line2: string | null;

  @ApiProperty()
  @Expose()
  city: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  state: string | null;

  @ApiProperty()
  @Expose()
  country: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  zipCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  latitude: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  longitude: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty()
  @Expose()
  isDefault: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: CustomerAddressEntity): CustomerAddressResponseDto {
    return plainToInstance(
      CustomerAddressResponseDto,
      {
        ...entity,
        latitude: entity.latitude == null ? null : Number(entity.latitude),
        longitude: entity.longitude == null ? null : Number(entity.longitude),
      },
      { excludeExtraneousValues: true },
    );
  }
}
