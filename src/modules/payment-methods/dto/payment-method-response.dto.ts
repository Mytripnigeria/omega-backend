import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { PaymentMethodEntity, PaymentMethodType } from '../entities/payment-method.entity';

export class PaymentMethodResponseDto {
  @ApiProperty({ format: 'uuid', example: 'pm1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ enum: ['cash', 'card', 'transfer', 'pos', 'mobile_money', 'wallet', 'other'], example: 'transfer' })
  @Expose()
  type: PaymentMethodType;

  @ApiProperty({ example: 'Bank Transfer' })
  @Expose()
  label: string;

  @ApiProperty({ example: true })
  @Expose()
  isEnabled: boolean;

  @ApiProperty({ type: [String], example: ['pos', 'self', 'storefront', 'omni'] })
  @Expose()
  visibility: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { accountNumber: '1234567890', bankCode: '058', bankName: 'GTBank' },
  })
  @Expose()
  config: Record<string, unknown> | null;

  @ApiProperty({ example: 0 })
  @Expose()
  order: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: PaymentMethodEntity): PaymentMethodResponseDto {
    return plainToInstance(PaymentMethodResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: PaymentMethodEntity[]): PaymentMethodResponseDto[] {
    return entities.map((e) => PaymentMethodResponseDto.from(e));
  }
}
