import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { CategoryType } from '../entities/category.entity';

export class FilterCategoryDto extends PaginationQueryDto {
  /** Free-text match against the category name (SQL LIKE). */
  @ApiPropertyOptional({ example: 'main', description: 'Case-insensitive name search' })
  @IsOptional()
  @IsString()
  search?: string;

  /** Restrict to a single category domain. */
  @ApiPropertyOptional({
    enum: CategoryType,
    example: CategoryType.MENU,
    description: 'Filter by category type',
  })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  /** "true" → active only, "false" → inactive only. Omit for both. */
  @ApiPropertyOptional({
    example: true,
    description: 'Filter by isActive flag (pass "true" or "false" as a string)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  status?: boolean;
}
