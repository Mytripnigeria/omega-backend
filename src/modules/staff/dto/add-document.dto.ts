import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUrl } from 'class-validator';
import { DocumentType } from '../entities/staff-document.entity';

export class AddDocumentDto {
  @ApiProperty({ example: 'National ID Card', description: 'Human-readable document label' })
  @IsString()
  name: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.ID })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty({ example: 'https://cdn.mrjollof.com/docs/national-id.jpg', description: 'Public URL of the uploaded document' })
  @IsUrl()
  url: string;
}
