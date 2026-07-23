import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { StaffEntity } from './staff.entity';

export enum DocumentType {
  CV = 'cv',
  CONTRACT = 'contract',
  ID = 'id',
  CERTIFICATE = 'certificate',
  OTHER = 'other',
}

@Entity('staff_documents')
export class StaffDocumentEntity {
  @ApiProperty({ format: 'uuid', example: '9e1f2a3b-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  staffId: string;

  @ManyToOne(() => StaffEntity, (staff) => staff.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;

  @ApiProperty({ example: 'Employment Contract 2024' })
  @Column()
  name: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.CONTRACT })
  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @ApiProperty({ example: 'https://cdn.example.com/docs/contract-amaka.pdf' })
  @Column()
  url: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt: Date;
}
