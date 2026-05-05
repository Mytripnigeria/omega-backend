import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { TaxRateEntity } from '../entities/tax-rate.entity';

export class TaxRateResponseDto {
  @ApiProperty({ format: 'uuid', example: 'tr1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 'VAT' })
  @Expose()
  name: string;

  @ApiProperty({ example: 7.5, description: 'Tax rate as a percentage (e.g. 7.5 = 7.5%)' })
  @Expose()
  ratePercent: number;

  @ApiProperty({ example: false, description: '`true` = tax is included in price; `false` = added at checkout' })
  @Expose()
  isInclusive: boolean;

  @ApiProperty({ example: false, description: '`true` = applied to all new products by default' })
  @Expose()
  isDefault: boolean;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: TaxRateEntity): TaxRateResponseDto {
    return plainToInstance(TaxRateResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: TaxRateEntity[]): TaxRateResponseDto[] {
    return entities.map((e) => TaxRateResponseDto.from(e));
  }
}
