import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { StockTransferStatus } from '../entities/stock-transfer.entity';

export class StockTransferItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateStockTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromLocationId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toLocationId: string;

  @ApiProperty({ type: () => [StockTransferItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items: StockTransferItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStockTransferDto extends PartialType(
  OmitType(CreateStockTransferDto, ['storeId'] as const),
) {}

export class StockTransferFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: StockTransferStatus })
  @IsOptional()
  @IsEnum(StockTransferStatus)
  status?: StockTransferStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;
}

export class ReceiveStockTransferLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0)
  receivedQuantity: number;
}

export class ReceiveStockTransferDto {
  @ApiProperty({ type: () => [ReceiveStockTransferLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockTransferLineDto)
  items: ReceiveStockTransferLineDto[];
}
