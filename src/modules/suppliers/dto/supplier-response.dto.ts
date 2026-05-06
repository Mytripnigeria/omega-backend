import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { SupplierEntity, SupplierStatus } from '../entities/supplier.entity';

export class SupplierResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  contactPerson: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  paymentTerms: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  category: string | null;

  @ApiProperty({ enum: SupplierStatus })
  @Expose()
  status: SupplierStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  rating: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  totalIngredients: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: SupplierEntity): SupplierResponseDto {
    return plainToInstance(
      SupplierResponseDto,
      {
        ...entity,
        rating: entity.rating == null ? null : Number(entity.rating),
      },
      { excludeExtraneousValues: true },
    );
  }
}
