import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** One place staff may sign in and clock in from. */
export class UpsertGeofenceDto {
  @ApiProperty({ example: 'Main kitchen' })
  @IsString()
  @MaxLength(80)
  label: string;

  @ApiProperty({ example: 7.7337 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 8.5214 })
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({
    example: 150,
    default: 100,
    description: 'How far from the centre still counts, in metres.',
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(20_000)
  radiusMeters?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Turn a place off without deleting it.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
