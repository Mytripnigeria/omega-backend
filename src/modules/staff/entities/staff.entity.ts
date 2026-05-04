import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StoreEntity } from '../../store/entities/store.entity';
import { RoleEntity } from '../../roles/entities/role.entity';
import { StaffDocumentEntity } from './staff-document.entity';

export enum EmploymentType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

export enum StaffStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on-leave',
  TERMINATED = 'terminated',
}

export enum SalaryPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('staff')
export class StaffEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  staffCode: string;

  @Column()
  storeId: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'storeId' })
  store: StoreEntity;

  @Column()
  roleId: string;

  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'roleId' })
  role: RoleEntity;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({
    type: 'enum',
    enum: StaffStatus,
    default: StaffStatus.ACTIVE,
  })
  status: StaffStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseSalary: number;

  @Column({
    type: 'enum',
    enum: SalaryPeriod,
    default: SalaryPeriod.MONTHLY,
  })
  salaryPeriod: SalaryPeriod;

  @Column({ nullable: true })
  bankName: string;

  @Column({ nullable: true })
  bankAccount: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  emergencyContact: string;

  @Column({ nullable: true })
  emergencyPhone: string;

  @Column({ type: 'date' })
  hireDate: string;

  @Column({ type: 'date', nullable: true })
  terminationDate: string;

  @Column({ nullable: true, select: false })
  pin: string;

  @OneToMany(() => StaffDocumentEntity, (doc) => doc.staff, { cascade: true })
  documents: StaffDocumentEntity[];

  @DeleteDateColumn()
  deletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
