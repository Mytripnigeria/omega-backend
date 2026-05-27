import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import {
  PushSubjectType,
  PushSubscriptionEntity,
} from '../entities/push-subscription.entity';

class SubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  p256dh!: string;

  @ApiProperty()
  @IsString()
  auth!: string;
}

export class CreatePushSubscriptionDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsString()
  endpoint!: string;

  @ApiProperty({ type: () => SubscriptionKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys!: SubscriptionKeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class PushSubscriptionResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: ['customer', 'staff'] })
  @Expose()
  subjectType!: PushSubjectType;

  @ApiProperty()
  @Expose()
  endpoint!: string;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  static from(entity: PushSubscriptionEntity): PushSubscriptionResponseDto {
    return plainToInstance(PushSubscriptionResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
