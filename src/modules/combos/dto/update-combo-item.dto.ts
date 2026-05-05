import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateComboItemDto {
  @ApiProperty({ example: 2, description: 'Updated quantity of this product in the combo (minimum 1)' })
  @IsInt()
  @Min(1)
  quantity: number;
}
