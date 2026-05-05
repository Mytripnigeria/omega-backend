import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ChannelsDto {
  @ApiPropertyOptional({ example: true, description: 'Enable email notifications' })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Enable SMS notifications' })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Enable push notifications' })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({ example: false, description: 'When true, all channels are silenced during the business do-not-disturb window' })
  @IsOptional()
  @IsBoolean()
  doNotDisturb?: boolean;
}

class EventsDto {
  @ApiPropertyOptional({ example: true, description: 'Notify on new incoming orders' })
  @IsOptional()
  @IsBoolean()
  newOrder?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Notify when a new customer registers' })
  @IsOptional()
  @IsBoolean()
  newCustomer?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Notify when product or ingredient stock falls below minimum' })
  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Send daily summary report' })
  @IsOptional()
  @IsBoolean()
  dailyReport?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Notify when a payment is received' })
  @IsOptional()
  @IsBoolean()
  paymentReceived?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Remind staff of upcoming shifts' })
  @IsOptional()
  @IsBoolean()
  shiftReminder?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    type: () => ChannelsDto,
    description: 'Delivery channel toggles. Send only the keys you want to change.',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelsDto)
  channels?: ChannelsDto;

  @ApiPropertyOptional({
    type: () => EventsDto,
    description: 'Per-event notification toggles. Send only the keys you want to change.',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EventsDto)
  events?: EventsDto;
}
