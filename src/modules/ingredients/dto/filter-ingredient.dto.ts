import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FilterIngredientDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by store' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Filter to ingredients that have a stock entry at this inventory location.',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ example: 'Rice', description: 'Search by ingredient name or SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'low_stock', description: 'Filter by stock status: "low_stock" returns ingredients below minStock' })
  @IsOptional()
  @IsString()
  status?: string;
}
