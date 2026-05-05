import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ShiftStatus } from '../entities/shift.entity';

export class ShiftFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'sf1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by staff member' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'r1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by role' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: ShiftStatus, example: ShiftStatus.SCHEDULED, description: 'Filter by shift status' })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @ApiPropertyOptional({ example: '2024-01-20', description: 'Filter shifts on a specific date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Start of date range (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2024-01-31', description: 'End of date range (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
