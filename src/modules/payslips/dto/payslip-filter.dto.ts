import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PayslipStatus } from '../entities/payslip.entity';

export class PayslipFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'sf1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by staff member' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ enum: PayslipStatus, example: PayslipStatus.PENDING, description: 'Filter by payslip status' })
  @IsOptional()
  @IsEnum(PayslipStatus)
  status?: PayslipStatus;

  @ApiPropertyOptional({ example: '2024-01', description: 'Filter by pay period (YYYY-MM)' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Filter payslips with period starting on or after this date' })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Filter payslips with period ending on or before this date' })
  @IsOptional()
  @IsDateString()
  periodTo?: string;
}
