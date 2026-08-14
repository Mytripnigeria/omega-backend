import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * Staff-initiated PIN change from the workstation Profile screen. Unlike the
 * admin `SetPinDto`, the current PIN must be supplied and is verified — anyone
 * who walks up to an unlocked till must not be able to lock the owner out.
 */
export class ChangePinDto {
  @ApiProperty({ example: '1234', description: 'The PIN currently in use' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  currentPin: string;

  @ApiProperty({ example: '5678', description: 'Exactly 4 digits' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  newPin: string;
}
