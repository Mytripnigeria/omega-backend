import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventories (#8) — adds ingredients.type (inventory variant: ingredient,
 * packaging, premix, hygiene, …). Defaults existing rows to 'ingredient'.
 * Additive and idempotent.
 */
export class IngredientType1780769900000 implements MigrationInterface {
  name = 'IngredientType1780769900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "type" character varying DEFAULT 'ingredient'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" DROP COLUMN IF EXISTS "type"`,
    );
  }
}
