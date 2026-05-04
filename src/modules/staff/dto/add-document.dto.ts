import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUrl } from 'class-validator';
import { DocumentType } from '../entities/staff-document.entity';

export class AddDocumentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty()
  @IsUrl()
  url: string;
}
