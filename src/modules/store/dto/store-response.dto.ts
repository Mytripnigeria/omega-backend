import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { StoreEntity, WeeklyHours } from '../entities/store.entity';

export class StoreResponseDto {
  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 'Lekki Branch' })
  @Expose()
  name: string;

  @ApiProperty({ example: '14 Admiralty Way, Lekki Phase 1' })
  @Expose()
  address: string;

  @ApiPropertyOptional({ example: 'Lagos', nullable: true })
  @Expose()
  city: string | null;

  @ApiPropertyOptional({ example: 'Lagos State', nullable: true })
  @Expose()
  state: string | null;

  @ApiProperty({ example: '+2348012345678' })
  @Expose()
  phone: string;

  @ApiProperty({ example: 'lekki@mrjollof.com' })
  @Expose()
  email: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/stores/lekki.png', nullable: true })
  @Expose()
  logoUrl: string | null;

  @ApiPropertyOptional({ example: 'Our flagship Lekki location, open daily.', nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ example: 'Africa/Lagos' })
  @Expose()
  timezone: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      monday: { open: '09:00', close: '22:00', closed: false },
      tuesday: { open: '09:00', close: '22:00', closed: false },
      saturday: { open: '10:00', close: '23:00', closed: false },
      sunday: { open: '12:00', close: '20:00', closed: false },
    },
  })
  @Expose()
  openingHours: WeeklyHours | null;

  @ApiPropertyOptional({ example: 5.0, nullable: true })
  @Expose()
  deliveryRadiusKm: number | null;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StoreEntity): StoreResponseDto {
    return plainToInstance(StoreResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: StoreEntity[]): StoreResponseDto[] {
    return entities.map((e) => StoreResponseDto.from(e));
  }
}
