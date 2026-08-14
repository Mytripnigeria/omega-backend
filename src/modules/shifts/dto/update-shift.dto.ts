import { PartialType, OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateShiftDto } from './create-shift.dto';
import { ShiftStatus } from '../entities/shift.entity';

/**
 * Every create field is editable except `storeId` — a shift cannot move between
 * stores, so that stays fixed for the life of the record.
 *
 * `staffId` *is* editable: the hub's edit dialog lets a manager reassign a
 * scheduled shift to a different staff member, and it posts the whole form
 * back. Omitting the field here made the global `forbidNonWhitelisted`
 * validation reject every save with "property staffId should not exist".
 */
export class UpdateShiftDto extends PartialType(
  OmitType(CreateShiftDto, ['storeId'] as const),
) {
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;
}
