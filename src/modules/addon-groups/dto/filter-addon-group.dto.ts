import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FilterAddOnGroupDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Proteins', description: 'Search by addon group name' })
  @IsOptional()
  @IsString()
  search?: string;
}
