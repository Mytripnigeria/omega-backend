import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { DomainEntity, SslStatus } from '../entities/domain.entity';

export class DomainResponseDto {
  @ApiProperty({ format: 'uuid', example: 'dm1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 'order.mrjollof.com' })
  @Expose()
  hostname: string;

  @ApiProperty({ example: false, description: '`true` if this is the primary domain' })
  @Expose()
  isPrimary: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  verifiedAt: Date | null;

  @ApiProperty({ example: 'mrjollof-verify-a1b2c3d4', description: 'TXT record value to add at your DNS provider' })
  @Expose()
  verificationToken: string;

  @ApiPropertyOptional({
    type: 'array',
    nullable: true,
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'TXT' },
        name: { type: 'string', example: '_mrjollof-challenge.order.mrjollof.com' },
        value: { type: 'string', example: 'mrjollof-verify-a1b2c3d4' },
      },
    },
  })
  @Expose()
  dnsRecords: { type: string; name: string; value: string }[] | null;

  @ApiProperty({ enum: ['pending', 'active', 'failed'], example: 'pending' })
  @Expose()
  sslStatus: SslStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: DomainEntity): DomainResponseDto {
    return plainToInstance(DomainResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: DomainEntity[]): DomainResponseDto[] {
    return entities.map((e) => DomainResponseDto.from(e));
  }
}
