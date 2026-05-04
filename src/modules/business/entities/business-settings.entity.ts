import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('business_settings')
export class BusinessSettingsEntity {
  @PrimaryColumn('uuid')
  businessId: string;

  // Receipt template
  @Column({ nullable: true, type: 'text' })
  receiptHeader: string;

  @Column({ nullable: true, type: 'text' })
  receiptFooter: string;

  @Column({ default: true })
  receiptShowLogo: boolean;

  @Column({ default: true })
  receiptShowItemPrices: boolean;

  @Column({ default: true })
  receiptShowTaxBreakdown: boolean;

  @Column({ default: false })
  receiptShowServerName: boolean;

  @Column({ default: true })
  receiptShowOrderNumber: boolean;

  @Column({ default: true })
  receiptCustomerCopy: boolean;

  // Notification quiet hours (HH:MM strings, business-wide default)
  @Column({ nullable: true, type: 'varchar', length: 5 })
  notificationDoNotDisturbStart: string | null;

  @Column({ nullable: true, type: 'varchar', length: 5 })
  notificationDoNotDisturbEnd: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
