import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  staffId: string;

  @ManyToOne(() => StaffEntity, (staff) => staff.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column()
  url: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
