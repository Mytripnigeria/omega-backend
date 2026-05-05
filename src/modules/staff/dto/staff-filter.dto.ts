import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { EmploymentType, StaffStatus } from '../entities/staff.entity';

export class StaffFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'r1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by role' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: StaffStatus, example: StaffStatus.ACTIVE, description: 'Filter by employment status' })
  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @ApiPropertyOptional({ enum: EmploymentType, example: EmploymentType.FULL_TIME, description: 'Filter by employment type' })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 'Amaka', description: 'Search by name, email, or staff code' })
  @IsOptional()
  @IsString()
  search?: string;
}
