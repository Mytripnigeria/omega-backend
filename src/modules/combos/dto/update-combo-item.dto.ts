import { IsInt, Min } from 'class-validator';

export class UpdateComboItemDto {
  @IsInt()
  @Min(1)
  quantity: number;
}
