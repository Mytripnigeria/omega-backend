import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { FileEntity } from '../entities/file.entity';

export class FileResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'products/2024/01/hero-image.jpg' })
  @Expose()
  key: string;

  @ApiProperty({ example: 'https://cdn.mrjollof.com/products/2024/01/hero-image.jpg' })
  @Expose()
  url: string;

  @ApiProperty({ example: 'hero-image.jpg' })
  @Expose()
  originalName: string;

  @ApiProperty({ example: 'image/jpeg' })
  @Expose()
  mimetype: string;

  @ApiProperty({ example: 204800 })
  @Expose()
  size: number;

  @ApiPropertyOptional({ example: 'products', nullable: true })
  @Expose()
  folder: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  uploadedById: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { width: 1200, height: 800, colorSpace: 'sRGB' },
  })
  @Expose()
  metadata: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: FileEntity): FileResponseDto {
    return plainToInstance(FileResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: FileEntity[]): FileResponseDto[] {
    return entities.map((e) => FileResponseDto.from(e));
  }
}
