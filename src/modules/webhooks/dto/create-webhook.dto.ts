import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_WEBHOOK_EVENTS = [
  'order.created',
  'order.updated',
  'order.completed',
  'order.cancelled',
  'payment.received',
  'payment.failed',
  'product.low_stock',
  'staff.shift_started',
  'staff.shift_ended',
] as const;

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://myapp.com/webhooks/omega', description: 'HTTPS endpoint that will receive event payloads' })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  url: string;

  @ApiProperty({
    type: [String],
    example: ['order.created', 'payment.received', 'product.low_stock'],
    description: `Event types to subscribe to. Valid values: ${ALLOWED_WEBHOOK_EVENTS.join(', ')}`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({ example: true, description: 'Whether this webhook is active. Inactive webhooks receive no events.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
