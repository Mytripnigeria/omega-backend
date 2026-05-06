import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  CustomerPaymentMethodEntity,
  PaymentMethodBrand,
} from '../entities/customer-payment-method.entity';

export class CreateCustomerPaymentMethodDto {
  @ApiProperty({ enum: PaymentMethodBrand })
  @IsEnum(PaymentMethodBrand)
  brand: PaymentMethodBrand;

  @ApiProperty({ example: '4242' })
  @IsString()
  @Length(4, 4)
  last4: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])$/, { message: 'expMonth must be MM' })
  expMonth: string;

  @ApiProperty({ example: '2027' })
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'expYear must be YYYY' })
  expYear: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardholderName?: string;

  @ApiProperty({ description: 'Paystack authorization code from a verified transaction' })
  @IsString()
  authorizationCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerPaymentMethodDto extends PartialType(
  CreateCustomerPaymentMethodDto,
) {}

export class CustomerPaymentMethodResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  customerId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ enum: PaymentMethodBrand })
  @Expose()
  brand: PaymentMethodBrand;

  @ApiProperty()
  @Expose()
  last4: string;

  @ApiProperty()
  @Expose()
  expMonth: string;

  @ApiProperty()
  @Expose()
  expYear: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  cardholderName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  bank: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  channel: string | null;

  @ApiProperty()
  @Expose()
  isDefault: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: CustomerPaymentMethodEntity,
  ): CustomerPaymentMethodResponseDto {
    // Note: do NOT expose authorizationCode/bin in the response.
    return plainToInstance(CustomerPaymentMethodResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
