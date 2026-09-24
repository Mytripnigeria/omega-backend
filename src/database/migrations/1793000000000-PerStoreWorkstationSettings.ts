import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Round 13 — workstation settings belong to a store, and a store may have
 * several places staff can work from.
 *
 * 1. `workstation_settings` was keyed by business, so a merchant with three
 *    branches could not give them different PIN rules, clock-in windows,
 *    auto-accept or geofence — changing one changed all of them. Each store
 *    now gets its own row, seeded with exactly what its business had, so no
 *    merchant sees a behaviour change on deploy.
 * 2. The geofence was a single centre on that record. Places now live in
 *    `workstation_geofences`, one row each, and the existing centre is carried
 *    across as a location called "Main" so nobody is locked out mid-shift.
 */
export class PerStoreWorkstationSettings1793000000000 implements MigrationInterface {
  name = 'PerStoreWorkstationSettings1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "storeId" uuid`,
    );

    // The old key has to go BEFORE the rows are copied: while the primary key
    // is still ("businessId"), a business's three store rows all collide with
    // the row they were copied from, and the copy silently inserts nothing.
    // The key's generated name varies by how the table was created, so it is
    // looked up rather than guessed — and left alone if it is already the new one.
    await queryRunner.query(`
      DO $$
      DECLARE pk_name text;
      BEGIN
        SELECT conname INTO pk_name FROM pg_constraint
         WHERE conrelid = '"workstation_settings"'::regclass
           AND contype = 'p'
           AND pg_get_constraintdef(oid) <> 'PRIMARY KEY ("storeId")';
        IF pk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "workstation_settings" DROP CONSTRAINT %I', pk_name);
        END IF;
      END $$;
    `);

    // One row per store, copying that business's settings, so a business with
    // three stores ends up with three identical rows rather than one shared
    // one and nothing about a merchant's workstation changes on deploy.
    //
    // The columns are read from the table rather than listed here: this record
    // has grown by ALTER over several rounds and will grow again, and a
    // hand-written list silently drops whatever it forgot.
    await queryRunner.query(`
      DO $$
      DECLARE cols text; vals text;
      BEGIN
        SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position),
               string_agg(format('w.%I', column_name), ', ' ORDER BY ordinal_position)
          INTO cols, vals
          FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'workstation_settings'
           AND column_name NOT IN ('storeId', 'createdAt', 'updatedAt');

        EXECUTE format(
          'INSERT INTO "workstation_settings" ("storeId", %s, "createdAt", "updatedAt")
             SELECT s."id", %s, now(), now()
               FROM "workstation_settings" w
               JOIN "stores" s ON s."businessId" = w."businessId"
              WHERE w."storeId" IS NULL
                AND NOT EXISTS (
                      SELECT 1 FROM "workstation_settings" x WHERE x."storeId" = s."id"
                    )',
          cols, vals
        );
      END $$;
    `);

    // The old business-keyed rows have served their purpose. A business with no
    // stores at all has nothing to carry them to; its workstation record goes,
    // and the next store it opens gets defaults.
    await queryRunner.query(
      `DELETE FROM "workstation_settings" WHERE "storeId" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ALTER COLUMN "storeId" SET NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = '"workstation_settings"'::regclass AND contype = 'p'
        ) THEN
          ALTER TABLE "workstation_settings" ADD PRIMARY KEY ("storeId");
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workstation_settings_businessId" ON "workstation_settings" ("businessId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workstation_geofences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "businessId" uuid NOT NULL,
        "label" character varying NOT NULL,
        "latitude" numeric(10,7) NOT NULL,
        "longitude" numeric(10,7) NOT NULL,
        "radiusMeters" integer NOT NULL DEFAULT 100,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workstation_geofences" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workstation_geofences_storeId" ON "workstation_geofences" ("storeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workstation_geofences_businessId" ON "workstation_geofences" ("businessId")`,
    );

    // Carry the single fence across, so a store that was geofenced yesterday
    // is geofenced in the same place today.
    await queryRunner.query(`
      INSERT INTO "workstation_geofences" ("storeId", "businessId", "label", "latitude", "longitude", "radiusMeters")
      SELECT w."storeId", w."businessId", 'Main', w."geofenceLatitude", w."geofenceLongitude",
             COALESCE(w."geofenceRadiusMeters", 100)
      FROM "workstation_settings" w
      WHERE w."geofenceLatitude" IS NOT NULL
        AND w."geofenceLongitude" IS NOT NULL
        AND NOT EXISTS (
              SELECT 1 FROM "workstation_geofences" g WHERE g."storeId" = w."storeId"
            )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workstation_geofences"`);
    // Collapse back to one row per business, keeping whichever store's row
    // was written last.
    await queryRunner.query(`
      DO $$
      DECLARE pk_name text;
      BEGIN
        SELECT conname INTO pk_name FROM pg_constraint
        WHERE conrelid = '"workstation_settings"'::regclass AND contype = 'p';
        IF pk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "workstation_settings" DROP CONSTRAINT %I', pk_name);
        END IF;
      END $$;
    `);
    // Keep exactly one row per business. Stores migrated together share an
    // `updatedAt` to the microsecond, so that alone is not a tie-break and the
    // old primary key could not be rebuilt; storeId settles it.
    await queryRunner.query(`
      DELETE FROM "workstation_settings" a
      USING "workstation_settings" b
      WHERE a."businessId" = b."businessId"
        AND (a."updatedAt", a."storeId") < (b."updatedAt", b."storeId")
    `);
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "storeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD PRIMARY KEY ("businessId")`,
    );
  }
}
