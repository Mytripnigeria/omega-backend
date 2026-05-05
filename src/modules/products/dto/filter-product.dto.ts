import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FilterProductDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by store' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'cat1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by category' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by availability status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ example: 'Jollof', description: 'Search by product name, SKU, or product code' })
  @IsOptional()
  @IsString()
  search?: string;
}
