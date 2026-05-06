import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { InventoryLocationType } from '../entities/inventory-location.entity';

export class InventoryLocationFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: InventoryLocationType })
  @IsOptional()
  @IsEnum(InventoryLocationType)
  type?: InventoryLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
