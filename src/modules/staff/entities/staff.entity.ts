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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'STF042', description: 'Unique staff code used for workstation login' })
  @Column({ unique: true })
  staffCode: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'storeId' })
  store: StoreEntity;

  @ApiProperty({ format: 'uuid', example: 'd3e4f5a6-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  roleId: string;

  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'roleId' })
  role: RoleEntity;

  @ApiProperty({ example: 'Amaka' })
  @Column()
  firstName: string;

  @ApiProperty({ example: 'Osei' })
  @Column()
  lastName: string;

  @ApiProperty({ example: 'amaka.osei@mrjollof.com' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ example: '+2348023456789' })
  @Column()
  phone: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/amaka.png', nullable: true })
  @Column({ nullable: true })
  avatar: string;

  @ApiProperty({ enum: EmploymentType, example: EmploymentType.FULL_TIME })
  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @ApiProperty({ enum: StaffStatus, example: StaffStatus.ACTIVE })
  @Column({
    type: 'enum',
    enum: StaffStatus,
    default: StaffStatus.ACTIVE,
  })
  status: StaffStatus;

  @ApiProperty({ example: 150000.00, description: 'Base salary amount' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseSalary: number;

  @ApiProperty({ enum: SalaryPeriod, example: SalaryPeriod.MONTHLY })
  @Column({
    type: 'enum',
    enum: SalaryPeriod,
    default: SalaryPeriod.MONTHLY,
  })
  salaryPeriod: SalaryPeriod;

  @ApiPropertyOptional({ example: 'First Bank', nullable: true })
  @Column({ nullable: true })
  bankName: string;

  @ApiPropertyOptional({ example: '2034567890', nullable: true })
  @Column({ nullable: true })
  bankAccount: string;

  @ApiPropertyOptional({ example: '5 Marina Street, Lagos Island', nullable: true })
  @Column({ nullable: true })
  address: string;

  @ApiPropertyOptional({ example: 'Chidi Osei', nullable: true, description: 'Name of emergency contact' })
  @Column({ nullable: true })
  emergencyContact: string;

  @ApiPropertyOptional({ example: '+2348034567890', nullable: true })
  @Column({ nullable: true })
  emergencyPhone: string;

  @ApiProperty({ example: '2024-01-15', description: 'ISO date string (YYYY-MM-DD)' })
  @Column({ type: 'date' })
  hireDate: string;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'ISO date string; null if still employed' })
  @Column({ type: 'date', nullable: true })
  terminationDate: string;

  @ApiProperty({ writeOnly: true, description: 'Hashed PIN — never returned in responses' })
  @Column({ nullable: true, select: false })
  pin: string;

  @OneToMany(() => StaffDocumentEntity, (doc) => doc.staff, { cascade: true })
  documents: StaffDocumentEntity[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
