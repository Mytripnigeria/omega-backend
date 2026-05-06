import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  CustomerSource,
  CustomerStatus,
  LoyaltyTier,
} from '../entities/customer.entity';

export class CustomerFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'amaka' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerSource })
  @IsOptional()
  @IsEnum(CustomerSource)
  source?: CustomerSource;

  @ApiPropertyOptional({ enum: LoyaltyTier })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  loyaltyTier?: LoyaltyTier;

  @ApiPropertyOptional({ example: 'vip' })
  @IsOptional()
  @IsString()
  group?: string;
}
