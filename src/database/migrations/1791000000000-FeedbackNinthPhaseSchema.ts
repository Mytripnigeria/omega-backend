import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Round-9 schema.
 *
 * Chowdeck goes multi-channel: a store may sell through several Chowdeck vendor
 * listings, so the one-row-per-store unique constraint is replaced by
 * (storeId, merchantReference), channels gain a merchant-facing `label`, and
 * the menu-id map is re-keyed onto the channel — the same product carries a
 * different numeric Chowdeck id on each listing, so keying by store made the
 * two rows collide and a second channel could never be mapped.
 */
export class FeedbackNinthPhaseSchema1791000000000
  implements MigrationInterface
{
  name = 'FeedbackNinthPhaseSchema1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- chowdeck_integrations: several channels per store ----
    await queryRunner.query(`
      ALTER TABLE "chowdeck_integrations"
        ADD COLUMN IF NOT EXISTS "label" character varying
    `);
    // The old constraint's generated name varies by how it was created, so drop
    // whatever unique constraint covers storeId alone.
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'chowdeck_integrations'
            AND con.contype = 'u'
            AND (SELECT count(*) FROM unnest(con.conkey)) = 1
            AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = rel.oid
                AND a.attnum = con.conkey[1]
                AND a.attname = 'storeId'
            )
        LOOP
          EXECUTE format(
            'ALTER TABLE "chowdeck_integrations" DROP CONSTRAINT %I', c.conname
          );
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_chowdeck_integration_store_reference'
        ) THEN
          ALTER TABLE "chowdeck_integrations"
            ADD CONSTRAINT "UQ_chowdeck_integration_store_reference"
            UNIQUE ("storeId", "merchantReference");
        END IF;
      END $$;
    `);

    // ---- chowdeck_menu_items: keyed by channel ----
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items"
        ADD COLUMN IF NOT EXISTS "integrationId" uuid
    `);
    // Existing rows belong to the store's only channel.
    await queryRunner.query(`
      UPDATE "chowdeck_menu_items" m
      SET "integrationId" = i."id"
      FROM "chowdeck_integrations" i
      WHERE m."integrationId" IS NULL AND i."storeId" = m."storeId"
    `);
    // A mapping with no channel is unusable; drop those rather than fail the
    // NOT NULL below (they re-populate on the next menu sync).
    await queryRunner.query(`
      DELETE FROM "chowdeck_menu_items" WHERE "integrationId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items"
        ALTER COLUMN "integrationId" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chowdeck_menu_items_integrationId"
        ON "chowdeck_menu_items" ("integrationId")
    `);
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'chowdeck_menu_items' AND con.contype = 'u'
        LOOP
          EXECUTE format(
            'ALTER TABLE "chowdeck_menu_items" DROP CONSTRAINT %I', c.conname
          );
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items"
        ADD CONSTRAINT "UQ_chowdeck_menu_item_integration_product"
        UNIQUE ("integrationId", "productId")
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items"
        ADD CONSTRAINT "UQ_chowdeck_menu_item_integration_menuid"
        UNIQUE ("integrationId", "chowdeckMenuId")
    `);

    // ---- store_links: cross-store order help (workstation linking) ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "requesterStoreId" uuid NOT NULL,
        "requesterBusinessId" uuid NOT NULL,
        "targetStoreId" uuid NOT NULL,
        "targetBusinessId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "message" character varying,
        "requestedByStaffId" uuid,
        "respondedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_links" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_store_link_pair" UNIQUE ("requesterStoreId", "targetStoreId")
      )
    `);
    for (const col of [
      'requesterStoreId',
      'requesterBusinessId',
      'targetStoreId',
      'targetBusinessId',
      'status',
    ]) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_store_links_${col}" ON "store_links" ("${col}")`,
      );
    }

    // ---- Cloove (CloveAI) omnichannel ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clove_integrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "businessId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "label" character varying,
        "cloveStoreId" character varying,
        "apiKey" character varying NOT NULL,
        "baseUrl" character varying NOT NULL DEFAULT 'https://api.clooveai.com',
        "isEnabled" boolean NOT NULL DEFAULT false,
        "autoAccept" boolean NOT NULL DEFAULT false,
        "lastMenuSyncAt" TIMESTAMP WITH TIME ZONE,
        "lastOrderSyncAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clove_integrations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_clove_integration_store_workspace" UNIQUE ("storeId", "cloveStoreId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_clove_integrations_businessId" ON "clove_integrations" ("businessId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_clove_integrations_storeId" ON "clove_integrations" ("storeId")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clove_menu_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storeId" uuid NOT NULL,
        "integrationId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "cloveProductId" character varying NOT NULL,
        "name" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clove_menu_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_clove_menu_item_integration_product" UNIQUE ("integrationId", "productId"),
        CONSTRAINT "UQ_clove_menu_item_integration_cloveid" UNIQUE ("integrationId", "cloveProductId")
      )
    `);
    for (const col of ['storeId', 'integrationId', 'cloveProductId']) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_clove_menu_items_${col}" ON "clove_menu_items" ("${col}")`,
      );
    }

    // `clove` joins the order channel vocabulary.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_channel_enum') THEN
          ALTER TYPE "orders_channel_enum" ADD VALUE IF NOT EXISTS 'clove';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clove_menu_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clove_integrations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "store_links"`);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items"
        DROP CONSTRAINT IF EXISTS "UQ_chowdeck_menu_item_integration_menuid"
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items"
        DROP CONSTRAINT IF EXISTS "UQ_chowdeck_menu_item_integration_product"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_chowdeck_menu_items_integrationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_menu_items" DROP COLUMN IF EXISTS "integrationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_integrations"
        DROP CONSTRAINT IF EXISTS "UQ_chowdeck_integration_store_reference"
    `);
    await queryRunner.query(`
      ALTER TABLE "chowdeck_integrations" DROP COLUMN IF EXISTS "label"
    `);
  }
}
