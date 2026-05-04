import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderItemDto {
  @ApiProperty({ example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21', format: 'uuid' })
  @IsString()
  id: string;

  @ApiProperty({ example: 0, description: 'Zero-based sort position' })
  @IsNumber()
  order: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({
    type: [ReorderItemDto],
    description: 'Full ordered list of categories to persist',
    example: [
      { id: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21', order: 0 },
      { id: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21', order: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
