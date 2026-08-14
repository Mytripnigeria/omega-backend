import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chowdeck omnichannel integration.
 *
 *  - `chowdeck_integrations` — per-store credentials. Store-scoped because a
 *    Chowdeck `merchantReference` identifies one vendor location.
 *  - `chowdeck_menu_items` — product ↔ Chowdeck menu-id map. Required because
 *    order webhooks identify lines only by Chowdeck's numeric menu id, so
 *    without it an incoming order can't deduct inventory.
 *  - `orders.externalReference` — the marketplace's own order reference. Unique
 *    so a retried webhook can't create the order twice.
 *  - `'chowdeck'` added to the order channel enum.
 *
 * Idempotent throughout.
 */
export class ChowdeckIntegration1790500000000 implements MigrationInterface {
  name = 'ChowdeckIntegration1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chowdeck_integrations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "merchantReference" character varying NOT NULL,
        "secretKey" character varying NOT NULL,
        "baseUrl" character varying NOT NULL DEFAULT 'https://api.chowdeck.com',
        "isEnabled" boolean NOT NULL DEFAULT false,
        "autoAccept" boolean NOT NULL DEFAULT false,
        "webhookToken" character varying,
        "lastMenuSyncAt" TIMESTAMP WITH TIME ZONE,
        "lastWebhookAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chowdeck_integrations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chowdeck_integrations_store" ON "chowdeck_integrations" ("storeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chowdeck_integrations_business" ON "chowdeck_integrations" ("businessId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chowdeck_integrations_merchant" ON "chowdeck_integrations" ("merchantReference")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chowdeck_menu_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "chowdeckMenuId" bigint NOT NULL,
        "name" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chowdeck_menu_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chowdeck_menu_store_menu" ON "chowdeck_menu_items" ("storeId", "chowdeckMenuId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chowdeck_menu_store_product" ON "chowdeck_menu_items" ("storeId", "productId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chowdeck_menu_store" ON "chowdeck_menu_items" ("storeId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "externalReference" character varying
    `);
    // Unique so a retried ORDER_CREATED webhook can never duplicate an order.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_external_reference" ON "orders" ("externalReference") WHERE "externalReference" IS NOT NULL`,
    );

    // ADD VALUE can't run inside a transaction block on some PG versions.
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(
      `ALTER TYPE "public"."orders_channel_enum" ADD VALUE IF NOT EXISTS 'chowdeck'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_orders_external_reference"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "externalReference"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "chowdeck_menu_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chowdeck_integrations"`);
    // Postgres can't drop an enum value without recreating the type; the extra
    // 'chowdeck' value is harmless to leave behind.
  }
}
