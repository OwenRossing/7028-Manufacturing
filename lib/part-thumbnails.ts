import { prisma } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_part_thumbnails (
        part_id TEXT PRIMARY KEY,
        storage_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);
  }
  return ensurePromise;
}

export async function getPartThumbnail(partId: string): Promise<string | null> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ storage_key: string }>>(
    "SELECT storage_key FROM app_part_thumbnails WHERE part_id = $1",
    partId
  );
  return rows[0]?.storage_key ?? null;
}

export async function getPartThumbnailMap(partIds: string[]): Promise<Map<string, string>> {
  await ensureTable();
  if (!partIds.length) return new Map();
  const rows = await prisma.$queryRawUnsafe<Array<{ part_id: string; storage_key: string }>>(
    "SELECT part_id, storage_key FROM app_part_thumbnails WHERE part_id = ANY($1::text[])",
    partIds
  );
  return new Map(rows.map((row) => [row.part_id, row.storage_key]));
}

export async function setPartThumbnail(partId: string, storageKey: string | null): Promise<void> {
  await ensureTable();
  if (!storageKey) {
    await prisma.$executeRawUnsafe("DELETE FROM app_part_thumbnails WHERE part_id = $1", partId);
    return;
  }
  await prisma.$executeRawUnsafe(
    "INSERT INTO app_part_thumbnails (part_id, storage_key) VALUES ($1, $2) ON CONFLICT (part_id) DO UPDATE SET storage_key = EXCLUDED.storage_key",
    partId,
    storageKey
  );
}

