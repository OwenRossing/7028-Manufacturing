import { prisma } from "@/lib/db";

type PartThumbnailRecord = { partId: string; storageKey: string };
type PartThumbnailModel = {
  findUnique(args: unknown): Promise<{ storageKey: string } | null>;
  findMany(args: unknown): Promise<PartThumbnailRecord[]>;
  deleteMany(args: unknown): Promise<unknown>;
  upsert(args: unknown): Promise<unknown>;
};

const partThumbnailModel = (prisma as unknown as { partThumbnail: PartThumbnailModel }).partThumbnail;

export async function getPartThumbnail(partId: string): Promise<string | null> {
  const row = await partThumbnailModel.findUnique({
    where: { partId },
    select: { storageKey: true }
  });
  return row?.storageKey ?? null;
}

export async function getPartThumbnailMap(partIds: string[]): Promise<Map<string, string>> {
  if (!partIds.length) return new Map();
  const rows = await partThumbnailModel.findMany({
    where: { partId: { in: partIds } },
    select: { partId: true, storageKey: true }
  });
  return new Map(rows.map((row) => [row.partId, row.storageKey]));
}

export async function setPartThumbnail(partId: string, storageKey: string | null): Promise<void> {
  if (!storageKey) {
    await partThumbnailModel.deleteMany({ where: { partId } });
    return;
  }

  await partThumbnailModel.upsert({
    where: { partId },
    create: { partId, storageKey },
    update: { storageKey }
  });
}
