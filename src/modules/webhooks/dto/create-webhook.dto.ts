import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

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
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
