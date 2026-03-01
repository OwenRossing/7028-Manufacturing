-- CreateTable
CREATE TABLE IF NOT EXISTS "PartThumbnail" (
  "partId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartThumbnail_pkey" PRIMARY KEY ("partId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartThumbnail_storageKey_idx" ON "PartThumbnail"("storageKey");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PartThumbnail_partId_fkey'
  ) THEN
    ALTER TABLE "PartThumbnail"
      ADD CONSTRAINT "PartThumbnail_partId_fkey"
      FOREIGN KEY ("partId") REFERENCES "Part"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill legacy raw SQL table data if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_part_thumbnails'
  ) THEN
    INSERT INTO "PartThumbnail" ("partId", "storageKey", "createdAt", "updatedAt")
    SELECT part_id, storage_key, created_at, CURRENT_TIMESTAMP
    FROM app_part_thumbnails
    ON CONFLICT ("partId") DO UPDATE
    SET "storageKey" = EXCLUDED."storageKey",
        "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
END $$;
