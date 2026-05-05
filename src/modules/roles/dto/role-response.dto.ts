import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { RoleEntity } from '../entities/role.entity';

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid', example: 'd3e4f5a6-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  storeId: string;

  @ApiProperty({ example: 'Cashier' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'Handles POS orders and payments', nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({
    type: [String],
    example: ['view_products', 'create_orders', 'view_reports'],
  })
  @Expose()
  permissions: string[];

  @ApiPropertyOptional({ example: '#4CAF50', nullable: true })
  @Expose()
  color: string | null;

  @ApiProperty({ example: 0, description: 'Number of staff currently assigned to this role' })
  @Expose()
  staffCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: RoleEntity & { staffCount?: number }): RoleResponseDto {
    return plainToInstance(
      RoleResponseDto,
      { ...entity, staffCount: entity.staffCount ?? 0 },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: (RoleEntity & { staffCount?: number })[]): RoleResponseDto[] {
    return entities.map((e) => RoleResponseDto.from(e));
  }
}
