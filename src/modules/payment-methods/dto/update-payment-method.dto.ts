import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePaymentMethodDto } from './create-payment-method.dto';

export class UpdatePaymentMethodDto extends PartialType(CreatePaymentMethodDto) {}

class ReorderItemDto {
  @ApiProperty({ format: 'uuid', example: 'pm1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Payment method ID' })
  @IsString()
  id: string;

  @ApiProperty({ example: 2, description: 'New display order (0 = first)' })
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderPaymentMethodsDto {
  @ApiProperty({ type: () => [ReorderItemDto], description: 'Full ordered list of payment method IDs and their new positions' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
