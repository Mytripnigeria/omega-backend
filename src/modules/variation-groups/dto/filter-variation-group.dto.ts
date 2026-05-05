import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FilterVariationGroupDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Size', description: 'Search by variation group name' })
  @IsOptional()
  @IsString()
  search?: string;
}
