import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { WebhookEntity } from '../entities/webhook.entity';

export class WebhookResponseDto {
  @ApiProperty({ format: 'uuid', example: 'wh1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 'https://myapp.com/webhooks/omega' })
  @Expose()
  url: string;

  @ApiProperty({
    type: [String],
    example: ['order.created', 'payment.received', 'low_stock.alert'],
  })
  @Expose()
  events: string[];

  @ApiProperty({ example: 'a1b2', description: 'Last 4 characters of the current signing secret' })
  @Expose()
  secretLastFour: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  lastTriggeredAt: Date | null;

  @ApiProperty({ example: 0, description: 'Consecutive delivery failure count' })
  @Expose()
  failureCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: WebhookEntity): WebhookResponseDto {
    return plainToInstance(WebhookResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: WebhookEntity[]): WebhookResponseDto[] {
    return entities.map((e) => WebhookResponseDto.from(e));
  }
}

export class WebhookWithSecretResponseDto extends WebhookResponseDto {
  @ApiProperty({ example: 'whsec_a1b2c3d4e5f6...', description: 'Plaintext signing secret — returned ONLY on create or rotate-secret. Store immediately.' })
  @Expose()
  secret: string;

  static fromWithSecret(entity: WebhookEntity, secret: string): WebhookWithSecretResponseDto {
    const dto = plainToInstance(WebhookWithSecretResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    dto.secret = secret;
    return dto;
  }
}
