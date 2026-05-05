import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { AddOnGroupEntity } from '../entities/addon-group.entity';
import { AddOnEntity } from '../entities/addon.entity';

export class AddOnResponseDto {
  @ApiProperty({ format: 'uuid', example: 'ao1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Grilled Chicken' })
  @Expose()
  name: string;

  @ApiProperty({ example: 500.0 })
  @Expose()
  price: number;

  @ApiProperty({ example: true })
  @Expose()
  isAvailable: boolean;

  @ApiProperty({ format: 'uuid', example: 'ag1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  addOnGroupId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: AddOnEntity): AddOnResponseDto {
    return plainToInstance(AddOnResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

export class AddOnGroupResponseDto {
  @ApiProperty({ format: 'uuid', example: 'ag1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Proteins' })
  @Expose()
  name: string;

  @ApiProperty({ example: 0 })
  @Expose()
  minSelection: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @Expose()
  maxSelection: number | null;

  @ApiProperty({ example: true })
  @Expose()
  status: boolean;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ type: () => [AddOnResponseDto] })
  @Expose()
  @Type(() => AddOnResponseDto)
  addons: AddOnResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: AddOnGroupEntity): AddOnGroupResponseDto {
    return plainToInstance(AddOnGroupResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: AddOnGroupEntity[]): AddOnGroupResponseDto[] {
    return entities.map((e) => AddOnGroupResponseDto.from(e));
  }
}
