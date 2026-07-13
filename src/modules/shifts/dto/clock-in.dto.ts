import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

/**
 * Optional device coordinates sent on clock-in. Required only when the
 * merchant has enabled geofencing (Workstation Settings) — the backend then
 * checks the staff member is inside the work-environment radius.
 */
export class ClockInDto {
  @ApiPropertyOptional({ example: 6.5244, description: 'Device latitude.' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.3792, description: 'Device longitude.' })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
