import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feedback (sixth) — schema for this round:
 *
 *  • payouts + payout_bank_accounts — these tables were only ever created by
 *    DB_SYNC in dev; no migration made them, so a prod DB (DB_SYNC=false)
 *    returns 500 "relation does not exist" on every /payouts call. Create them.
 *  • categories.storeId — categories become store-scoped (was business-scoped).
 *    Backfill each to its business's first store; swap the business-level unique
 *    constraint for a store-level one so two branches can each have "Rice".
 *  • addon_groups.storeId — same store-scoping for add-on groups.
 *
 * Additive / idempotent throughout, safe over a DB_SYNC'd schema.
 */
export class FeedbackSixthPhaseSchema1789500000000
  implements MigrationInterface
{
  name = 'FeedbackSixthPhaseSchema1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. payouts bank accounts ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payout_bank_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "label" character varying NOT NULL,
        "accountNumber" character varying NOT NULL,
        "bankCode" character varying NOT NULL,
        "bankName" character varying,
        "accountName" character varying,
        "recipientCode" character varying,
        "currency" character varying(3) NOT NULL DEFAULT 'NGN',
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_payout_bank_accounts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payout_bank_accounts_business" ON "payout_bank_accounts" ("businessId")`,
    );

    // ── 2. payouts ────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payouts_status_enum') THEN
          CREATE TYPE "payouts_status_enum" AS ENUM
            ('pending','queued','processing','success','failed','cancelled');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payouts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "reference" character varying NOT NULL,
        "bankAccountId" uuid NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'NGN',
        "status" "payouts_status_enum" NOT NULL DEFAULT 'pending',
        "providerTransferCode" character varying,
        "providerStatus" character varying,
        "failureReason" text,
        "requestedById" uuid,
        "requestedByName" character varying,
        "note" text,
        "queuedAt" TIMESTAMP WITH TIME ZONE,
        "processingAt" TIMESTAMP WITH TIME ZONE,
        "settledAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payouts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payouts_business" ON "payouts" ("businessId")`,
    );

    // ── 3. categories.storeId ─────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "storeId" uuid`,
    );
    // Backfill: each category → its business's earliest store. Single-store
    // merchants (the common case) get the correct store; multi-store merchants
    // can re-point/duplicate afterwards.
    await queryRunner.query(`
      UPDATE "categories" c
      SET "storeId" = s.id
      FROM (
        SELECT DISTINCT ON ("businessId") "businessId", id
        FROM "stores" ORDER BY "businessId", "createdAt" ASC
      ) s
      WHERE c."storeId" IS NULL AND s."businessId" = c."businessId"
    `);
    // Replace the business-level unique constraint with a store-level one.
    await queryRunner.query(`
      DO $$ DECLARE c record; BEGIN
        FOR c IN
          SELECT con.conname FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
          WHERE rel.relname = 'categories' AND con.contype = 'u'
        LOOP
          EXECUTE format('ALTER TABLE "categories" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_store_type_name" ON "categories" ("storeId", "type", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_categories_store" ON "categories" ("storeId")`,
    );

    // ── 4. addon_groups.storeId ───────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "addon_groups" ADD COLUMN IF NOT EXISTS "storeId" uuid`,
    );
    await queryRunner.query(`
      UPDATE "addon_groups" a
      SET "storeId" = s.id
      FROM (
        SELECT DISTINCT ON ("businessId") "businessId", id
        FROM "stores" ORDER BY "businessId", "createdAt" ASC
      ) s
      WHERE a."storeId" IS NULL AND s."businessId" = a."businessId"
    `);
    await queryRunner.query(`
      DO $$ DECLARE c record; BEGIN
        FOR c IN
          SELECT con.conname FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
          WHERE rel.relname = 'addon_groups' AND con.contype = 'u'
        LOOP
          EXECUTE format('ALTER TABLE "addon_groups" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_addon_groups_store_name" ON "addon_groups" ("storeId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_addon_groups_store" ON "addon_groups" ("storeId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_addon_groups_store_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_addon_groups_store"`);
    await queryRunner.query(
      `ALTER TABLE "addon_groups" DROP COLUMN IF EXISTS "storeId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_store_type_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_store"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN IF EXISTS "storeId"`,
    );
    // payouts tables intentionally left in place (dropping would lose data).
  }
}
