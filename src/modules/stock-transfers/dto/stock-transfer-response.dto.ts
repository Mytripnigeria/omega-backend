import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  StockTransferEntity,
  StockTransferStatus,
} from '../entities/stock-transfer.entity';
import { StockTransferItemEntity } from '../entities/stock-transfer-item.entity';

export class StockTransferItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  ingredientId: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'kg' })
  @Expose()
  unit: string;

  @ApiProperty({ example: 25 })
  @Expose()
  quantity: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  receivedQuantity: number | null;

  @ApiProperty({ example: 1200 })
  @Expose()
  unitCost: number;

  @ApiProperty({ example: 30000 })
  @Expose()
  totalCost: number;

  static from(item: StockTransferItemEntity): StockTransferItemResponseDto {
    return plainToInstance(
      StockTransferItemResponseDto,
      {
        ...item,
        quantity: Number(item.quantity),
        receivedQuantity:
          item.receivedQuantity == null ? null : Number(item.receivedQuantity),
        unitCost: Number(item.unitCost),
        totalCost: Number(item.unitCost) * Number(item.quantity),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class StockTransferResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  fromLocationId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  toLocationId: string;

  @ApiProperty({ enum: StockTransferStatus })
  @Expose()
  status: StockTransferStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  requestedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  requestedByName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  approvedById: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  approvedAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  receivedById: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  receivedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: () => [StockTransferItemResponseDto] })
  @Expose()
  @Type(() => StockTransferItemResponseDto)
  items: StockTransferItemResponseDto[];

  @ApiProperty({ example: 5 })
  @Expose()
  totalItems: number;

  @ApiProperty({ example: 150000 })
  @Expose()
  totalValue: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StockTransferEntity): StockTransferResponseDto {
    const items = (entity.items ?? []).map((i) =>
      StockTransferItemResponseDto.from(i),
    );
    return plainToInstance(
      StockTransferResponseDto,
      {
        ...entity,
        items,
        totalItems: items.length,
        totalValue: items.reduce((sum, i) => sum + i.totalCost, 0),
      },
      { excludeExtraneousValues: true },
    );
  }
}
