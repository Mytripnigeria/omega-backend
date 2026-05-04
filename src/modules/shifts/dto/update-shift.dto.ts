import { PartialType, OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateShiftDto } from './create-shift.dto';
import { ShiftStatus } from '../entities/shift.entity';

export class UpdateShiftDto extends PartialType(
  OmitType(CreateShiftDto, ['storeId', 'staffId'] as const),
) {
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;
}
