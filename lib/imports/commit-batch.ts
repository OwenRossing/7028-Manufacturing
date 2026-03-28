import { ImportBatchStatus, ImportRowAction, PartEventType, PartStatus, PrismaClient } from "@prisma/client";
import { IMPORT_SOURCE_TYPE } from "@/lib/imports/source-type";

type OnshapeIdentity = {
  documentId: string;
  workspaceId: string;
  elementId: string;
  partId: string;
};

type TransactionClient = {
  $executeRawUnsafe: (...args: unknown[]) => Promise<unknown>;
  part: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      quantityRequired: number;
      description: string | null;
    } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<unknown>;
  };
  partEvent: {
    create: (args: unknown) => Promise<unknown>;
  };
  importBatch: {
    update: (args: unknown) => Promise<unknown>;
  };
};

export type CommitBatchResult = {
  alreadyCommitted: boolean;
  created: number;
  updated: number;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractOnshapeIdentity(raw: unknown): OnshapeIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const documentId = asString(source.onshapeDocumentId);
  const workspaceId = asString(source.onshapeWorkspaceId);
  const elementId = asString(source.onshapeElementId);
  const partId = asString(source.onshapePartId);
  if (!documentId || !workspaceId || !elementId || !partId) return null;
  return { documentId, workspaceId, elementId, partId };
}

function extractOnshapeImportNotes(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const notes = asString(source.onshapeImportNotes);
  return notes ?? null;
}

function mergeDescription(existing: string | null, importedNotes: string | null): string | null {
  if (!importedNotes) return existing;
  const current = asString(existing ?? "");
  if (!current) return importedNotes;
  if (current.includes(importedNotes)) return current;
  return `${current}\n${importedNotes}`;
}

async function attachOnshapeIdentity(
  tx: TransactionClient,
  partId: string,
  identity: OnshapeIdentity
): Promise<void> {
  await tx.$executeRawUnsafe(
    'UPDATE "Part" SET "onshapeDocumentId" = $1, "onshapeWorkspaceId" = $2, "onshapeElementId" = $3, "onshapePartId" = $4 WHERE "id" = $5',
    identity.documentId,
    identity.workspaceId,
    identity.elementId,
    identity.partId,
    partId
  );
}

export async function commitImportBatch(params: {
  prisma: PrismaClient;
  batchId: string;
  actorUserId: string;
  resync?: boolean;
}): Promise<CommitBatchResult> {
  const batch = await params.prisma.importBatch.findUnique({
    where: { id: params.batchId },
    include: { rows: true }
  });
  if (!batch) {
    throw new Error("Import batch not found.");
  }
  if (batch.status === ImportBatchStatus.COMMITTED) {
    return { alreadyCommitted: true, created: 0, updated: 0 };
  }

  let created = 0;
  let updated = 0;
  await params.prisma.$transaction(async (tx) => {
    const trx = tx as unknown as TransactionClient;
    for (const row of batch.rows) {
      if (row.action === ImportRowAction.ERROR || !row.partNumber || !row.name) continue;

      const existing = await trx.part.findUnique({
        where: {
          projectId_partNumber: {
            projectId: batch.projectId,
            partNumber: row.partNumber
          }
        }
      });

      const identity =
        batch.sourceType === IMPORT_SOURCE_TYPE.ONSHAPE_API
          ? extractOnshapeIdentity(row.rawJson)
          : null;
      const importedNotes =
        batch.sourceType === IMPORT_SOURCE_TYPE.ONSHAPE_API
          ? extractOnshapeImportNotes(row.rawJson)
          : null;

      if (row.action === ImportRowAction.CREATE) {
        if (existing) {
          continue;
        }
        const newPart = await trx.part.create({
          data: {
            projectId: batch.projectId,
            partNumber: row.partNumber,
            name: row.name,
            quantityRequired: row.quantityNeeded ?? 1,
            description: importedNotes,
            status: PartStatus.DESIGNED
          }
        });
        if (identity) {
          await attachOnshapeIdentity(trx, newPart.id, identity);
        }
        await trx.partEvent.create({
          data: {
            partId: newPart.id,
            actorUserId: params.actorUserId,
            eventType: PartEventType.IMPORTED,
            payloadJson: {
              batchId: batch.id,
              action: "CREATE",
              sourceType: batch.sourceType,
              resync: Boolean(params.resync)
            }
          }
        });
        created += 1;
        continue;
      }

      if (row.action === ImportRowAction.UPDATE) {
        if (!existing) {
          continue;
        }
        await trx.part.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            quantityRequired: row.quantityNeeded ?? existing.quantityRequired,
            description: mergeDescription(existing.description, importedNotes)
          }
        });
        if (identity) {
          await attachOnshapeIdentity(trx, existing.id, identity);
        }
        await trx.partEvent.create({
          data: {
            partId: existing.id,
            actorUserId: params.actorUserId,
            eventType: PartEventType.IMPORTED,
            payloadJson: {
              batchId: batch.id,
              action: "UPDATE",
              sourceType: batch.sourceType,
              resync: Boolean(params.resync)
            }
          }
        });
        updated += 1;
      }
    }

    await trx.importBatch.update({
      where: { id: params.batchId },
      data: {
        status: ImportBatchStatus.COMMITTED,
        completedAt: new Date()
      }
    });
  });

  return { alreadyCommitted: false, created, updated };
}
