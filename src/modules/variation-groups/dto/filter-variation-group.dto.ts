import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FilterVariationGroupDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
