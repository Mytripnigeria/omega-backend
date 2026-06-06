import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  ChecklistAssignmentType,
  ChecklistEntity,
  ChecklistFrequency,
  ChecklistItem,
  ChecklistStatus,
} from '../entities/checklist.entity';

export class ChecklistItemInputDto {
  @ApiPropertyOptional({
    description: 'Existing item id. Omit when adding a new item — the server generates a UUID.',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Check fridge temperatures' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order: number;
}

export class CreateChecklistDto {
  @ApiProperty({ example: 'Opening Checklist' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ enum: ChecklistAssignmentType })
  @IsEnum(ChecklistAssignmentType)
  assignmentType: ChecklistAssignmentType;

  // Required only when assignmentType is role/staff; ignored for all_staff.
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required when assignmentType is "role" (roleId) or "staff" (staffId). Omit for "all_staff".',
  })
  @ValidateIf((o) => o.assignmentType !== ChecklistAssignmentType.ALL_STAFF)
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Display label; computed server-side when omitted.' })
  @IsOptional()
  @IsString()
  assignedToName?: string;

  @ApiProperty({ enum: ChecklistFrequency })
  @IsEnum(ChecklistFrequency)
  frequency: ChecklistFrequency;

  @ApiPropertyOptional({ example: '08:00', description: 'HH:MM (24-hour).' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'dueTime must be in HH:MM (24-hour) format' })
  dueTime?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ type: [ChecklistItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemInputDto)
  items: ChecklistItemInputDto[];
}

export class UpdateChecklistDto extends PartialType(CreateChecklistDto) {}

export class ToggleChecklistItemDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isCompleted: boolean;
}

export class ChecklistFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: ChecklistAssignmentType })
  @IsOptional()
  @IsEnum(ChecklistAssignmentType)
  assignmentType?: ChecklistAssignmentType;

  @ApiPropertyOptional({ enum: ChecklistFrequency })
  @IsOptional()
  @IsEnum(ChecklistFrequency)
  frequency?: ChecklistFrequency;

  @ApiPropertyOptional({ enum: ChecklistStatus })
  @IsOptional()
  @IsEnum(ChecklistStatus)
  status?: ChecklistStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  /** When set, only return checklists relevant to the given staff: their personal
   *  assignments + role assignments + all-staff. The service resolves the staff's
   *  roleId from the staff token. */
  @ApiPropertyOptional({ description: 'Filter to checklists assigned to this staff id (role + personal + all_staff).' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class ChecklistResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ enum: ChecklistAssignmentType })
  @Expose()
  assignmentType: ChecklistAssignmentType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  assignedToId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  assignedToName: string | null;

  @ApiProperty({ enum: ChecklistFrequency })
  @Expose()
  frequency: ChecklistFrequency;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  dueTime: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  dueDate: string | null;

  @ApiProperty({ enum: ChecklistStatus })
  @Expose()
  status: ChecklistStatus;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  @Expose()
  items: ChecklistItem[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ChecklistEntity): ChecklistResponseDto {
    return plainToInstance(
      ChecklistResponseDto,
      { ...entity, items: Array.isArray(entity.items) ? entity.items : [] },
      { excludeExtraneousValues: true },
    );
  }
}
