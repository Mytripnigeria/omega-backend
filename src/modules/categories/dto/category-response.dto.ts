import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { CategoryEntity, CategoryType } from '../entities/category.entity';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Mains' })
  @Expose()
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.MENU })
  @Expose()
  type: CategoryType;

  @ApiPropertyOptional({ example: '🍽️', nullable: true })
  @Expose()
  emoji: string | null;

  @ApiPropertyOptional({ example: 'Hearty mains served with sides', nullable: true })
  @Expose()
  description: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cat-mains.png', nullable: true })
  @Expose()
  imageUrl: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  imageFileId: string | null;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ example: 0 })
  @Expose()
  order: number;

  @ApiPropertyOptional({ example: ['pos', 'website'], type: [String], nullable: true })
  @Expose()
  visibility: string[] | null;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 0, description: 'Number of products in this category. Computed at read time.' })
  @Expose()
  productCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: CategoryEntity & { productCount?: number }): CategoryResponseDto {
    return plainToInstance(
      CategoryResponseDto,
      { ...entity, productCount: entity.productCount ?? 0 },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(
    entities: (CategoryEntity & { productCount?: number })[],
  ): CategoryResponseDto[] {
    return entities.map((e) => CategoryResponseDto.from(e));
  }
}
