import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * productId ↔ Cloove product id.
 *
 * Cloove has no external-reference field on a product, so this map is the only
 * link between their catalogue and ours — it is what lets a pulled order deduct
 * the right stock. Keyed by the channel, since the same product gets a distinct
 * Cloove id in each workspace.
 */
@Entity('clove_menu_items')
@Unique(['integrationId', 'productId'])
@Unique(['integrationId', 'cloveProductId'])
export class CloveMenuItemEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  integrationId: string;

  @ApiProperty({ format: 'uuid', description: 'Our product.' })
  @Column({ type: 'uuid' })
  productId: string;

  @ApiProperty({ description: "Cloove's product id." })
  @Column({ type: 'varchar' })
  @Index()
  cloveProductId: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
