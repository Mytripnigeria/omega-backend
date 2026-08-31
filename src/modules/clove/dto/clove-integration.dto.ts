import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertCloveIntegrationDto {
  @ApiPropertyOptional({
    description:
      'Force creation of an additional channel instead of updating the ' +
      "store's existing one. Set by the hub's \"Add channel\" action.",
  })
  @IsOptional()
  @IsBoolean()
  createNew?: boolean;

  @ApiPropertyOptional({ example: 'Scoops x Mr. Jollof' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Cloove API key. Omit when updating to keep the stored key.',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: "Cloove's store id, when they have several." })
  @IsOptional()
  @IsString()
  cloveStoreId?: string;

  @ApiPropertyOptional({ example: 'https://api.clooveai.com' })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoAccept?: boolean;
}
