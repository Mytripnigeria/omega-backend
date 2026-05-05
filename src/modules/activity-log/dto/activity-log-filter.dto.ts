import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ActivityLogFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'shift', description: 'Filter by resource type (e.g. order, shift, payslip)' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by specific resource id' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by who performed the action' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ enum: ['admin', 'staff', 'system'] })
  @IsOptional()
  @IsEnum(['admin', 'staff', 'system'])
  actorType?: 'admin' | 'staff' | 'system';

  @ApiPropertyOptional({
    example: 'shift.clocked_in',
    description: 'Filter by exact action key, or use wildcard suffix `shift.*` to match a namespace',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
