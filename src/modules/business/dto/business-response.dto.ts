import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { BusinessEntity } from '../entities/business.entity';

export class BusinessResponseDto {
  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Mr. Jollof' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'Mr. Jollof Foods Limited', nullable: true })
  @Expose()
  legalName: string | null;

  @ApiPropertyOptional({ example: 'RC1234567', nullable: true })
  @Expose()
  registrationNumber: string | null;

  @ApiPropertyOptional({ example: '12345678-0001', nullable: true })
  @Expose()
  taxId: string | null;

  @ApiPropertyOptional({ example: 'hello@mrjollof.com', nullable: true })
  @Expose()
  email: string | null;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @Expose()
  phone: string | null;

  @ApiPropertyOptional({ example: '14 Admiralty Way, Lekki Phase 1, Lagos', nullable: true })
  @Expose()
  address: string | null;

  @ApiProperty({ example: 'NGN' })
  @Expose()
  currency: string;

  @ApiProperty({ example: 'Africa/Lagos' })
  @Expose()
  timezone: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  logoFileId: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png', nullable: true })
  @Expose()
  logoUrl: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: BusinessEntity): BusinessResponseDto {
    return plainToInstance(BusinessResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
