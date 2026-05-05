import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, Transform, plainToInstance } from 'class-transformer';
import {
  EmploymentType,
  SalaryPeriod,
  StaffEntity,
  StaffStatus,
} from '../entities/staff.entity';
import {
  DocumentType,
  StaffDocumentEntity,
} from '../entities/staff-document.entity';

export class StaffDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  staffId: string;

  @ApiProperty({ example: 'Employment Contract 2024' })
  @Expose()
  name: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.CONTRACT })
  @Expose()
  type: DocumentType;

  @ApiProperty({ example: 'https://cdn.example.com/docs/contract-amaka.pdf' })
  @Expose()
  url: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  uploadedAt: Date;

  static from(entity: StaffDocumentEntity): StaffDocumentResponseDto {
    return plainToInstance(StaffDocumentResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

export class StaffResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'STF001' })
  @Expose()
  staffCode: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  roleId: string;

  @ApiProperty({ example: 'Cashier', description: 'Denormalised role name (empty string when role is unloaded)' })
  @Expose()
  roleName: string;

  @ApiProperty({ example: 'Amaka' })
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @Expose()
  lastName: string;

  @ApiProperty({ example: 'amaka@mrjollof.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: '+2348012345678' })
  @Expose()
  phone: string;

  @ApiPropertyOptional({ nullable: true, example: 'https://cdn.example.com/avatars/amaka.png' })
  @Expose()
  avatar: string | null;

  @ApiProperty({ enum: EmploymentType })
  @Expose()
  employmentType: EmploymentType;

  @ApiProperty({ enum: StaffStatus })
  @Expose()
  status: StaffStatus;

  @ApiProperty({ example: 150000 })
  @Expose()
  @Transform(({ value }) => (value == null ? value : Number(value)))
  baseSalary: number;

  @ApiProperty({ enum: SalaryPeriod })
  @Expose()
  salaryPeriod: SalaryPeriod;

  @ApiPropertyOptional({ nullable: true, example: 'GTBank' })
  @Expose()
  bankName: string | null;

  @ApiPropertyOptional({ nullable: true, example: '0123456789' })
  @Expose()
  bankAccount: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  emergencyContact: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  emergencyPhone: string | null;

  @ApiProperty({ example: '2024-01-15' })
  @Expose()
  hireDate: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  @Expose()
  terminationDate: string | null;

  @ApiProperty({ type: () => [StaffDocumentResponseDto] })
  @Expose()
  @Type(() => StaffDocumentResponseDto)
  documents: StaffDocumentResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StaffEntity): StaffResponseDto {
    return plainToInstance(
      StaffResponseDto,
      {
        ...entity,
        roleName: entity.role?.name ?? '',
        documents: entity.documents ?? [],
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: StaffEntity[]): StaffResponseDto[] {
    return entities.map((e) => StaffResponseDto.from(e));
  }
}
