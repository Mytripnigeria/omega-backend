import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @IsNumber()
  adjustment: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
