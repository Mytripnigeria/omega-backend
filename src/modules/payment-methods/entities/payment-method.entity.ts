import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentMethodType =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'pos'
  | 'mobile_money'
  | 'other';

@Entity('payment_methods')
@Unique(['businessId', 'label'])
export class PaymentMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @Column({
    type: 'enum',
    enum: ['cash', 'card', 'transfer', 'pos', 'mobile_money', 'other'],
  })
  type: PaymentMethodType;

  @Column()
  label: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
