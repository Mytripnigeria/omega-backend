import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PrinterType = 'kitchen' | 'receipt' | 'bar' | 'label';
export type PrinterConnection = 'network' | 'usb' | 'bluetooth' | 'cloud';

@Entity('printers')
export class PrinterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['kitchen', 'receipt', 'bar', 'label'],
  })
  type: PrinterType;

  @Column({
    type: 'enum',
    enum: ['network', 'usb', 'bluetooth', 'cloud'],
  })
  connection: PrinterConnection;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
