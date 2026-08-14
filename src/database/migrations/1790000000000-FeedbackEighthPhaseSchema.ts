import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Round-8 feedback schema.
 *
 * Every statement is idempotent (`IF NOT EXISTS` / catalogue-guarded) so the
 * migration can be re-run safely against a database that was partially
 * upgraded.
 *
 * 1. `ingredient_movements` gains the location the movement actually landed on,
 *    plus that location's own before/after figures. The existing
 *    `previousStock`/`newStock` are the ingredient's business-wide totals, so
 *    the movement log could only say "was 10 → now 15" without saying *where* —
 *    meaningless for an ingredient stocked in several places.
 *
 * 2. `expenses` becomes line-item based: a submission carries many items, each
 *    with a name, type, unit, quantity, unit price, line total and supplier,
 *    instead of one free-text description. Stored as JSONB so a submission
 *    stays a single row, with the legacy `description`/`amount` left in place
 *    (existing expenses keep rendering, and `amount` remains the total).
 */
export class FeedbackEighthPhaseSchema1790000000000
  implements MigrationInterface
{
  name = 'FeedbackEighthPhaseSchema1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1. per-location movement history -------------------------------
    await queryRunner.query(`
      ALTER TABLE "ingredient_movements"
        ADD COLUMN IF NOT EXISTS "locationId" uuid,
        ADD COLUMN IF NOT EXISTS "locationName" character varying,
        ADD COLUMN IF NOT EXISTS "locationType" character varying,
        ADD COLUMN IF NOT EXISTS "locationPreviousStock" numeric(15,3),
        ADD COLUMN IF NOT EXISTS "locationNewStock" numeric(15,3)
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ingredient_movements_location" ON "ingredient_movements" ("locationId")`,
    );

    // Backfill what can be known for certain: transfer rows already recorded
    // the receiving location by name, so the location can be resolved from it.
    // Stock figures stay NULL for historic rows — they were never captured, and
    // inventing them would be worse than the UI falling back to the totals.
    await queryRunner.query(`
      UPDATE "ingredient_movements" m
      SET "locationId" = l.id,
          "locationName" = l.name,
          "locationType" = l.type
      FROM "inventory_locations" l
      WHERE m."locationId" IS NULL
        AND m."toLocationName" IS NOT NULL
        AND l.name = m."toLocationName"
        AND l."storeId" = m."storeId"
    `);

    // ---- 2. itemised expenses -------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD COLUMN IF NOT EXISTS "items" jsonb,
        ADD COLUMN IF NOT EXISTS "supplierName" character varying
    `);
    // The description column stops being mandatory: an itemised submission
    // describes itself through its line items.
    await queryRunner.query(`
      ALTER TABLE "expenses" ALTER COLUMN "description" DROP NOT NULL
    `);

    // ---- 3. staff access to the merchant dashboard -----------------------
    // A dashboard login is an `admins` row; linking it to a staff member (and
    // to the stores and modules they may work in) is what lets a merchant grant
    // one of their staff restricted access to the hub. Existing owner rows keep
    // NULL `permissions`, which the guard reads as unrestricted — so enabling
    // this cannot lock a merchant out of their own dashboard.
    await queryRunner.query(`
      ALTER TABLE "admins"
        ADD COLUMN IF NOT EXISTS "staffId" uuid,
        ADD COLUMN IF NOT EXISTS "storeIds" text,
        ADD COLUMN IF NOT EXISTS "permissions" text,
        ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admins_staff" ON "admins" ("staffId")`,
    );

    // ---- 4. review photos ------------------------------------------------
    // Customers could always attach photos to a review in the storefront, but
    // there was nowhere to put them, so they were silently dropped on submit.
    await queryRunner.query(`
      ALTER TABLE "order_reviews"
        ADD COLUMN IF NOT EXISTS "imageUrls" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ingredient_movements_location"`,
    );
    await queryRunner.query(`
      ALTER TABLE "ingredient_movements"
        DROP COLUMN IF EXISTS "locationId",
        DROP COLUMN IF EXISTS "locationName",
        DROP COLUMN IF EXISTS "locationType",
        DROP COLUMN IF EXISTS "locationPreviousStock",
        DROP COLUMN IF EXISTS "locationNewStock"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admins_staff"`);
    await queryRunner.query(`
      ALTER TABLE "admins"
        DROP COLUMN IF EXISTS "staffId",
        DROP COLUMN IF EXISTS "storeIds",
        DROP COLUMN IF EXISTS "permissions",
        DROP COLUMN IF EXISTS "mustChangePassword"
    `);
    // `items` / `supplierName` and `order_reviews."imageUrls"` are left in
    // place — dropping them would discard data recorded since the upgrade.
  }
}
