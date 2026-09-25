import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StoreLinkEntity, StoreLinkStatus } from '../entities/store-link.entity';

export class RequestStoreLinkDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The store id to request access to, as given by its owner.',
  })
  @IsUUID()
  targetStoreId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Which of your stores will help run those orders. A workstation leaves ' +
      'this out — it is the store that is signed in. An owner setting the ' +
      'link up from the dashboard has to say which store they mean.',
  })
  @IsOptional()
  @IsUUID()
  requesterStoreId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}

export class RespondStoreLinkDto {
  @ApiProperty({ enum: [StoreLinkStatus.APPROVED, StoreLinkStatus.DECLINED] })
  @IsEnum([StoreLinkStatus.APPROVED, StoreLinkStatus.DECLINED] as const)
  status: StoreLinkStatus.APPROVED | StoreLinkStatus.DECLINED;
}

export class StoreLinkResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) requesterStoreId: string;
  @ApiPropertyOptional({ nullable: true }) requesterStoreName: string | null;
  @ApiProperty({ format: 'uuid' }) targetStoreId: string;
  @ApiPropertyOptional({ nullable: true }) targetStoreName: string | null;
  @ApiProperty({ enum: StoreLinkStatus }) status: StoreLinkStatus;
  @ApiPropertyOptional({ nullable: true }) message: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  respondedAt: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: string;

  static from(
    e: StoreLinkEntity,
    names: { requester?: string | null; target?: string | null } = {},
  ): StoreLinkResponseDto {
    return {
      id: e.id,
      requesterStoreId: e.requesterStoreId,
      requesterStoreName: names.requester ?? null,
      targetStoreId: e.targetStoreId,
      targetStoreName: names.target ?? null,
      status: e.status,
      message: e.message,
      respondedAt: e.respondedAt ? e.respondedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
