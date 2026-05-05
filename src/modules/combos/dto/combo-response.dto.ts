import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { ComboEntity } from '../entities/combo.entity';
import { ComboItemEntity } from '../entities/combo-item.entity';

export class EmbeddedProductSummaryDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Jollof Rice' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'JR-001', nullable: true })
  @Expose()
  productCode: string | null;

  @ApiProperty({ example: 2500.0 })
  @Expose()
  sellingPrice: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/products/jollof.png', nullable: true })
  @Expose()
  imageUrl: string | null;
}

export class ComboItemResponseDto {
  @ApiProperty({ format: 'uuid', example: 'ci1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'cb1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  comboId: string;

  @ApiProperty({ format: 'uuid', example: 'p1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  productId: string;

  @ApiProperty({ example: 1 })
  @Expose()
  quantity: number;

  @ApiPropertyOptional({ type: () => EmbeddedProductSummaryDto, nullable: true })
  @Expose()
  @Type(() => EmbeddedProductSummaryDto)
  product: EmbeddedProductSummaryDto | null;

  static from(entity: ComboItemEntity): ComboItemResponseDto {
    return plainToInstance(ComboItemResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

export class ComboResponseDto {
  @ApiProperty({ format: 'uuid', example: 'cb1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Family Jollof Combo' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'Feeds 4', nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ example: 12000.0 })
  @Expose()
  price: number;

  @ApiProperty({ example: 15500.0 })
  @Expose()
  originalPrice: number;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/combos/family.png', nullable: true })
  @Expose()
  imageUrl: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  imageFileId: string | null;

  @ApiProperty({ example: 47 })
  @Expose()
  sales: number;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ type: () => [ComboItemResponseDto] })
  @Expose()
  @Type(() => ComboItemResponseDto)
  items: ComboItemResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ComboEntity): ComboResponseDto {
    return plainToInstance(ComboResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: ComboEntity[]): ComboResponseDto[] {
    return entities.map((e) => ComboResponseDto.from(e));
  }
}
