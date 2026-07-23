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
