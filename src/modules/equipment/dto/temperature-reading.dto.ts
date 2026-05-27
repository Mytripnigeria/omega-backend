import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { EquipmentTemperatureReadingEntity } from '../entities/equipment-temperature-reading.entity';

export class CreateTemperatureReadingDto {
  @ApiProperty({ example: -18.4, description: 'Temperature reading in degrees Celsius' })
  @IsNumber()
  temperatureC: number;

  @ApiPropertyOptional({ example: 'Door left open during rush' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class TemperatureReadingResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  equipmentId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ example: -18.4 })
  @Expose()
  temperatureC: number;

  @ApiProperty({ example: true })
  @Expose()
  isInRange: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  recordedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  recordedByName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  note: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  recordedAt: Date;

  static from(entity: EquipmentTemperatureReadingEntity): TemperatureReadingResponseDto {
    return plainToInstance(
      TemperatureReadingResponseDto,
      { ...entity, temperatureC: Number(entity.temperatureC) },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: EquipmentTemperatureReadingEntity[]): TemperatureReadingResponseDto[] {
    return entities.map((e) => TemperatureReadingResponseDto.from(e));
  }
}

/**
 * One row per equipment item that has a temperature range configured, with
 * the latest reading and whether it is currently in-range. Powers the
 * workstation "Temperature Monitor" alerts card.
 */
export class EquipmentTemperatureStatusDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  equipmentId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  minTempC: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  maxTempC: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Most recent reading (Celsius)' })
  @Expose()
  currentTemperature: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  lastReadingAt: Date | null;

  @ApiProperty({
    enum: ['ok', 'out_of_range', 'stale', 'unmeasured'],
    description:
      "'ok' = latest reading inside range; 'out_of_range' = breach; 'stale' = no reading in last 24h; 'unmeasured' = no range configured or no readings yet.",
  })
  @Expose()
  state: 'ok' | 'out_of_range' | 'stale' | 'unmeasured';
}
