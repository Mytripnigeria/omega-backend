import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAddOnDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CreateAddOnGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  minSelection?: number;

  @IsOptional()
  @IsNumber()
  maxSelection?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsString()
  storeId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddOnDto)
  addons?: CreateAddOnDto[];
}
