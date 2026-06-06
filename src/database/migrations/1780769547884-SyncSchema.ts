import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline sync migration: brings the database (previously managed by
 * `synchronize`) in line with the current entities. Written to be idempotent
 * (IF [NOT] EXISTS + guarded CREATE TYPE/CONSTRAINT) so it converges safely
 * over the existing partial-sync drift and can be re-run without erroring.
 *
 * `up()` is additive only — it creates missing tables/columns/indexes and
 * normalises a few defaults. It does not drop any data-bearing column or table.
 */
export class SyncSchema1780769547884 implements MigrationInterface {
    name = 'SyncSchema1780769547884'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // integration_credentials was created manually earlier with hand-picked
        // names; drop those so the canonical TypeORM-named ones can be added below.
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_integration_business"`);
        await queryRunner.query(`ALTER TABLE "integration_credentials" DROP CONSTRAINT IF EXISTS "UQ_integration_business_provider"`);

        // ─── Enums (guarded so re-runs / partial state don't error) ───────
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."kpi_targets_category_enum" AS ENUM('sales', 'orders', 'customers', 'efficiency', 'waste', 'labor', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."kpi_targets_assignmenttype_enum" AS ENUM('all_staff', 'role', 'staff'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."kpi_targets_period_enum" AS ENUM('one_off', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."kpi_targets_status_enum" AS ENUM('on_track', 'at_risk', 'behind', 'achieved', 'exceeded'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."checklists_assignmenttype_enum" AS ENUM('all_staff', 'role', 'staff'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."checklists_frequency_enum" AS ENUM('one_off', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."checklists_status_enum" AS ENUM('pending', 'in_progress', 'completed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."coupons_method_enum" AS ENUM('automatic', 'code'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);

        // ─── Tables ───────────────────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "kpi_targets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "storeId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "category" "public"."kpi_targets_category_enum" NOT NULL DEFAULT 'custom', "assignmentType" "public"."kpi_targets_assignmenttype_enum" NOT NULL, "assignedToId" uuid, "assignedToName" character varying, "period" "public"."kpi_targets_period_enum" NOT NULL, "targetValue" numeric(15,2) NOT NULL, "currentValue" numeric(15,2) NOT NULL DEFAULT '0', "unit" character varying NOT NULL DEFAULT '', "periodStart" date, "periodEnd" date, "status" "public"."kpi_targets_status_enum" NOT NULL DEFAULT 'on_track', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_88ef409223cd8f63665ca1cc0c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e0e5be0be09ec6cd003e12c625" ON "kpi_targets" ("businessId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f789d00371e767f0761246f8f7" ON "kpi_targets" ("storeId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_53523a82042365e2d10027f656" ON "kpi_targets" ("businessId", "storeId") `);

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "kpi_performances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kpiTargetId" uuid NOT NULL, "staffId" uuid NOT NULL, "staffName" character varying, "value" numeric(15,2) NOT NULL DEFAULT '0', "note" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a07e76516014d0b905c4f189802" UNIQUE ("kpiTargetId", "staffId"), CONSTRAINT "PK_a733674d061d01857cbd7684aa9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_4e44983ddcc6a153b56421599e" ON "kpi_performances" ("kpiTargetId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_2d4d17d706cdc302110473234d" ON "kpi_performances" ("staffId") `);

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ingredient_location_stocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ingredientId" uuid NOT NULL, "locationId" uuid NOT NULL, "storeId" uuid NOT NULL, "currentStock" numeric(15,3) NOT NULL DEFAULT '0', "minStock" numeric(15,3) NOT NULL DEFAULT '0', "lastRestocked" TIMESTAMP, "expiryDate" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6bf5774fc630d353ce3a5ccd7b1" UNIQUE ("ingredientId", "locationId"), CONSTRAINT "PK_20b0002c0f954072aa5f302503e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7a841bbbc52bb47a161e44c887" ON "ingredient_location_stocks" ("ingredientId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_8a161dd2386737609e480f7901" ON "ingredient_location_stocks" ("locationId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e73ad44458adbd8251890d2b10" ON "ingredient_location_stocks" ("storeId") `);

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "checklists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "storeId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "assignmentType" "public"."checklists_assignmenttype_enum" NOT NULL, "assignedToId" uuid, "assignedToName" character varying, "frequency" "public"."checklists_frequency_enum" NOT NULL, "dueTime" character varying(5), "dueDate" date, "status" "public"."checklists_status_enum" NOT NULL DEFAULT 'pending', "items" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_336ade2047f3d713e1afa20d2c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_712a28f6ef458d04190c92fec1" ON "checklists" ("businessId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_50843dd2f6edc37773244351d7" ON "checklists" ("storeId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_06b06f2c8181e05acd9466b6ff" ON "checklists" ("businessId", "storeId") `);

        // ─── Columns ──────────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "preferences" jsonb`);
        await queryRunner.query(`ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "supplierIds" text`);
        await queryRunner.query(`ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "expiryDate" date`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tableId" uuid`);
        await queryRunner.query(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "minTempC" numeric(6,2)`);
        await queryRunner.query(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "maxTempC" numeric(6,2)`);
        await queryRunner.query(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "lastReadingAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "method" "public"."coupons_method_enum" NOT NULL DEFAULT 'code'`);

        // ─── Default normalisations (idempotent) ──────────────────────────
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "channels" SET DEFAULT '{"email":true,"sms":false,"push":true,"doNotDisturb":false}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "events" SET DEFAULT '{"newOrder":true,"newCustomer":false,"lowStock":true,"dailyReport":true,"paymentReceived":true,"shiftReminder":false}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "loyalty_settings" ALTER COLUMN "pointsPerNaira" SET DEFAULT '0.1'`);
        await queryRunner.query(`ALTER TABLE "loyalty_settings" ALTER COLUMN "nairaPerPoint" SET DEFAULT '0.1'`);
        await queryRunner.query(`ALTER TABLE "business_settings" ALTER COLUMN "taxRate" SET DEFAULT '0.075'`);

        // ─── Indexes + constraints (guarded) ──────────────────────────────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_2a7fdd7af437285a3ef0fc8b64" ON "orders" ("tableId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_63aea624ac755852f5a1d76e0a" ON "integration_credentials" ("businessId") `);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "integration_credentials" ADD CONSTRAINT "UQ_9b654bb89856d09f50d8685b4d2" UNIQUE ("businessId", "provider"); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "kpi_performances" ADD CONSTRAINT "FK_4e44983ddcc6a153b56421599e1" FOREIGN KEY ("kpiTargetId") REFERENCES "kpi_targets"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "ingredient_location_stocks" ADD CONSTRAINT "FK_7a841bbbc52bb47a161e44c8876" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "ingredient_location_stocks" ADD CONSTRAINT "FK_8a161dd2386737609e480f79011" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingredient_location_stocks" DROP CONSTRAINT IF EXISTS "FK_8a161dd2386737609e480f79011"`);
        await queryRunner.query(`ALTER TABLE "ingredient_location_stocks" DROP CONSTRAINT IF EXISTS "FK_7a841bbbc52bb47a161e44c8876"`);
        await queryRunner.query(`ALTER TABLE "kpi_performances" DROP CONSTRAINT IF EXISTS "FK_4e44983ddcc6a153b56421599e1"`);
        await queryRunner.query(`ALTER TABLE "integration_credentials" DROP CONSTRAINT IF EXISTS "UQ_9b654bb89856d09f50d8685b4d2"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_63aea624ac755852f5a1d76e0a"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_2a7fdd7af437285a3ef0fc8b64"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN IF EXISTS "method"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."coupons_method_enum"`);
        await queryRunner.query(`ALTER TABLE "equipment" DROP COLUMN IF EXISTS "lastReadingAt"`);
        await queryRunner.query(`ALTER TABLE "equipment" DROP COLUMN IF EXISTS "maxTempC"`);
        await queryRunner.query(`ALTER TABLE "equipment" DROP COLUMN IF EXISTS "minTempC"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "tableId"`);
        await queryRunner.query(`ALTER TABLE "ingredients" DROP COLUMN IF EXISTS "expiryDate"`);
        await queryRunner.query(`ALTER TABLE "ingredients" DROP COLUMN IF EXISTS "supplierIds"`);
        await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN IF EXISTS "preferences"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_06b06f2c8181e05acd9466b6ff"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_50843dd2f6edc37773244351d7"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_712a28f6ef458d04190c92fec1"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "checklists"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."checklists_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."checklists_frequency_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."checklists_assignmenttype_enum"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_e73ad44458adbd8251890d2b10"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_8a161dd2386737609e480f7901"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_7a841bbbc52bb47a161e44c887"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ingredient_location_stocks"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_2d4d17d706cdc302110473234d"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4e44983ddcc6a153b56421599e"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "kpi_performances"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_53523a82042365e2d10027f656"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f789d00371e767f0761246f8f7"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_e0e5be0be09ec6cd003e12c625"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "kpi_targets"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."kpi_targets_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."kpi_targets_period_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."kpi_targets_assignmenttype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."kpi_targets_category_enum"`);
    }

}
