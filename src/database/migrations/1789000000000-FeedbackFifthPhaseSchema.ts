import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feedback (fifth) — schema for this round's changes:
 *
 *  • TIMEZONE: every `timestamp without time zone` column becomes
 *    `timestamptz`. The old naive columns stored the UTC wall clock (DEFAULT
 *    now() on a UTC server) and node-postgres reparsed them in the process's
 *    local zone, so the platform reported Nigerian 7:30am transactions as
 *    6:30am. Converting with `AT TIME ZONE 'UTC'` reinterprets the existing
 *    values as the UTC instants they really were, so history is preserved
 *    exactly while future reads/writes become zone-independent. This is what
 *    makes it safe for the app to run with TZ=Africa/Lagos (see src/timezone.ts).
 *  • product_ingredients.variationId — recipes can now be scoped per variation
 *  • addon_ingredients — add-ons consume stock of their own
 *  • delivery_regions — per-store delivery areas with their own fee
 *  • orders.deliveryRegionId / deliveryRegionName / pointsValue
 *
 * Idempotent throughout (IF NOT EXISTS / catalog-guarded), so it is safe over
 * any partial state left behind by earlier DB_SYNC=true runs.
 */
export class FeedbackFifthPhaseSchema1789000000000
  implements MigrationInterface
{
  name = 'FeedbackFifthPhaseSchema1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. timestamp -> timestamptz, everywhere ───────────────────────────
    // Driven off the catalog rather than a hardcoded list: the base schema was
    // created by DB_SYNC, so the full column set can't be assumed. Views would
    // block an ALTER TYPE, hence relkind = 'r' (ordinary tables only).
    await queryRunner.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT c.table_name, c.column_name
          FROM information_schema.columns c
          JOIN pg_class p ON p.relname = c.table_name
          JOIN pg_namespace n ON n.oid = p.relnamespace AND n.nspname = 'public'
          WHERE c.table_schema = 'public'
            AND c.data_type = 'timestamp without time zone'
            AND p.relkind = 'r'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            r.table_name, r.column_name, r.column_name
          );
        END LOOP;
      END $$;
    `);

    // ── 2. product_ingredients: per-variation recipes ─────────────────────
    await queryRunner.query(
      `ALTER TABLE "product_ingredients" ADD COLUMN IF NOT EXISTS "variationId" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_ingredients_variation'
        ) THEN
          ALTER TABLE "product_ingredients"
            ADD CONSTRAINT "FK_product_ingredients_variation"
            FOREIGN KEY ("variationId") REFERENCES "product_variations"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_ingredients_variation" ON "product_ingredients" ("variationId")`,
    );

    // ── 3. addon_ingredients ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "addon_ingredients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "addOnId" uuid NOT NULL,
        "ingredientId" uuid NOT NULL,
        "quantity" numeric(15,3) NOT NULL,
        "unit" character varying NOT NULL,
        CONSTRAINT "PK_addon_ingredients" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_addon_ingredients_addon'
        ) THEN
          ALTER TABLE "addon_ingredients"
            ADD CONSTRAINT "FK_addon_ingredients_addon"
            FOREIGN KEY ("addOnId") REFERENCES "addons"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_addon_ingredients_ingredient'
        ) THEN
          ALTER TABLE "addon_ingredients"
            ADD CONSTRAINT "FK_addon_ingredients_ingredient"
            FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_addon_ingredients_addon" ON "addon_ingredients" ("addOnId")`,
    );

    // ── 4. delivery_regions ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_regions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "fee" numeric(15,2) NOT NULL DEFAULT 0,
        "minOrderAmount" numeric(15,2) NOT NULL DEFAULT 0,
        "estimatedMinutes" integer,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_delivery_regions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_delivery_region_store_name" UNIQUE ("storeId", "name")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_regions_store" ON "delivery_regions" ("storeId")`,
    );

    // ── 5. orders: region + points value ──────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryRegionId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryRegionName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pointsValue" numeric(15,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "pointsValue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryRegionName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryRegionId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_regions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "addon_ingredients"`);
    await queryRunner.query(
      `ALTER TABLE "product_ingredients" DROP COLUMN IF EXISTS "variationId"`,
    );
    // The timestamptz conversion is intentionally not reversed: going back to a
    // naive column would discard the zone information and re-introduce the bug.
  }
}
