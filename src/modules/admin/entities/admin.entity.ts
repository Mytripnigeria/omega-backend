import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('admins')
export class AdminEntity {
  @ApiProperty({ format: 'uuid', example: '3a1b2c3d-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Emeka Obi' })
  @Column()
  fullName: string;

  @ApiProperty({ example: 'admin@mrjollof.com' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ writeOnly: true, description: 'Bcrypt-hashed password — never returned in responses' })
  @Column({ select: false })
  password: string;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @Column({ nullable: true })
  phone: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/emeka.png', nullable: true })
  @Column({ nullable: true })
  avatarUrl: string;

  @ApiProperty({ example: 'owner', description: 'Admin role within the business (e.g. owner, manager)' })
  @Column({ default: 'owner' })
  role: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Staff member this dashboard login belongs to. Set when a merchant ' +
      'grants one of their staff access to the merchant dashboard; null for ' +
      'the business owner.',
  })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  staffId: string | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description:
      'Stores this login may work in. `null` means every store in the ' +
      'business (the owner). A staff login is normally restricted to the ' +
      'store(s) they actually work at.',
  })
  @Column({ type: 'simple-array', nullable: true })
  storeIds: string[] | null;

  @ApiProperty({
    example: false,
    description:
      'Forces a password change on next login — set when a temporary password ' +
      'was issued.',
  })
  @Column({ default: false })
  mustChangePassword: boolean;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description:
      'Dashboard modules this login may use (e.g. `stocks.manage`, ' +
      '`reports.view`). `null` means unrestricted — the business owner. See ' +
      'common/permissions/dashboard-permissions.ts.',
  })
  @Column({ type: 'simple-array', nullable: true })
  permissions: string[] | null;

  @ApiProperty({ writeOnly: true, description: 'Hashed refresh token — never returned in responses' })
  @Column({ nullable: true, select: false })
  refreshToken: string;

  @ApiProperty({ example: false })
  @Column({ default: false })
  twoFactorEnabled: boolean;

  @ApiProperty({ writeOnly: true, description: 'TOTP secret — never returned in responses' })
  @Column({ nullable: true, select: false })
  twoFactorSecret: string;

  @ApiPropertyOptional({ type: [String], writeOnly: true, description: 'One-time backup codes — never returned in responses' })
  @Column({ type: 'simple-array', nullable: true, select: false })
  twoFactorBackupCodes: string[];

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}
