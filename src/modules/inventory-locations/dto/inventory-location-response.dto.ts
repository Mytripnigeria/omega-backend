import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  InventoryLocationEntity,
  InventoryLocationType,
} from '../entities/inventory-location.entity';

export class InventoryLocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ example: 'Main Kitchen Storage' })
  @Expose()
  name: string;

  @ApiProperty({ enum: InventoryLocationType })
  @Expose()
  type: InventoryLocationType;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ example: false })
  @Expose()
  isDefault: boolean;

  @ApiProperty({ example: 0 })
  @Expose()
  itemCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: InventoryLocationEntity,
    extras: { itemCount?: number } = {},
  ): InventoryLocationResponseDto {
    return plainToInstance(
      InventoryLocationResponseDto,
      { ...entity, itemCount: extras.itemCount ?? 0 },
      { excludeExtraneousValues: true },
    );
  }
}
