import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListFilesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'products', description: 'Filter by storage folder' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ format: 'uuid', example: '3a1b2c3d-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter by the admin who uploaded the files' })
  @IsOptional()
  @IsString()
  uploadedById?: string;
}
