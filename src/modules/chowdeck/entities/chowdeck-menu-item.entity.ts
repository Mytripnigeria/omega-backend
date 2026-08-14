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
 * Maps one of our products to its Chowdeck menu entry.
 *
 * This table exists because of an asymmetry in Chowdeck's API: we upload menu
 * items keyed by our own `reference` (the product id), but their **order
 * webhooks identify each line only by Chowdeck's numeric menu `id`** and a
 * free-text description. Without this map an incoming order can't be resolved
 * to a product, so nothing would deduct from inventory.
 *
 * Populated by the menu sync, which uploads and then reads `GET /menu` back —
 * that response carries both `id` and `reference`.
 */
@Entity('chowdeck_menu_items')
@Unique(['storeId', 'chowdeckMenuId'])
@Unique(['storeId', 'productId'])
export class ChowdeckMenuItemEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ format: 'uuid', description: 'Our product.' })
  @Column({ type: 'uuid' })
  productId: string;

  @ApiProperty({
    example: 2618213,
    description: "Chowdeck's numeric menu id — what order webhooks quote.",
  })
  @Column({ type: 'bigint' })
  @Index()
  chowdeckMenuId: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Name as it stands on Chowdeck, for diagnostics.',
  })
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
