import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';
import { CustomerStatus, LoyaltyTier } from '../entities/customer.entity';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(LoyaltyTier)
  loyaltyTier?: LoyaltyTier;
}
