import { PartialType, OmitType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CreateStaffDto } from './create-staff.dto';
import { StaffStatus } from '../entities/staff.entity';

export class UpdateStaffDto extends PartialType(
  OmitType(CreateStaffDto, ['storeId'] as const),
) {
  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @IsOptional()
  @IsDateString()
  terminationDate?: string;
}
