import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariationOptionDto {
  @ApiProperty({ example: 'Large', description: 'Option display name' })
  @IsString()
  name: string;
}

export class CreateVariationGroupDto {
  @ApiProperty({ example: 'Size', description: 'Variation group display name (e.g., Size, Spice Level, Temperature)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: true, description: 'Whether this variation group is available for selection' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: () => [CreateVariationOptionDto],
    example: [{ name: 'Small' }, { name: 'Medium' }, { name: 'Large' }],
    description: 'Initial set of options for this group',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariationOptionDto)
  options?: CreateVariationOptionDto[];
}
