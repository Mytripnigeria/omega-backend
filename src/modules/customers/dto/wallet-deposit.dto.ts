import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class WalletDepositInitDto {
  @ApiProperty({ example: 5000, description: 'Amount to add to the wallet, in naira' })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class WalletDepositVerifyDto {
  @ApiProperty({ example: 'WLT_1789000000000_a1b2c3d4' })
  @IsString()
  reference: string;
}
