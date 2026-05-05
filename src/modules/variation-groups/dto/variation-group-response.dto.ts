import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { VariationGroupEntity } from '../entities/variation-group.entity';
import { VariationOptionEntity } from '../entities/variation-option.entity';

export class VariationOptionResponseDto {
  @ApiProperty({ format: 'uuid', example: 'vo1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Large' })
  @Expose()
  name: string;

  @ApiProperty({ format: 'uuid', example: 'vg1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  variationGroupId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: VariationOptionEntity): VariationOptionResponseDto {
    return plainToInstance(VariationOptionResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

export class VariationGroupResponseDto {
  @ApiProperty({ format: 'uuid', example: 'vg1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Size' })
  @Expose()
  name: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ type: () => [VariationOptionResponseDto] })
  @Expose()
  @Type(() => VariationOptionResponseDto)
  options: VariationOptionResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: VariationGroupEntity): VariationGroupResponseDto {
    return plainToInstance(VariationGroupResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: VariationGroupEntity[]): VariationGroupResponseDto[] {
    return entities.map((e) => VariationGroupResponseDto.from(e));
  }
}
