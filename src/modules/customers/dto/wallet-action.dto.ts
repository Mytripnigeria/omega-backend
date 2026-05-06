import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class WalletActionDto {
  @ApiProperty({ example: 5000, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'Loyalty top-up' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiPropertyOptional({ example: 'order:abc-123' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class PointsActionDto {
  @ApiProperty({ example: 250, minimum: 1 })
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ example: 'Earned on order #1234' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  orderId?: string;
}
