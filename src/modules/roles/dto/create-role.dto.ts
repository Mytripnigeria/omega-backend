import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this role belongs to' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 'Cashier', description: 'Display name for the role' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Front-of-house cashier with POS access' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [String],
    example: ['view_products', 'manage_orders', 'process_payments'],
    description: 'Permission strings from GET /roles/permissions',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions: string[];

  @ApiPropertyOptional({ example: '#F97316', description: 'Hex colour used to label this role in the UI' })
  @IsOptional()
  @IsString()
  color?: string;
}
