import { ImportBatchStatus, ImportRowAction, PartEventType, PartStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { isAdminUser } from "@/lib/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required for BOM commit.", 403);
  }

  const { batchId } = await params;
  const token = request.headers.get("x-idempotency-key");
  const scope = `import-commit:${batchId}`;
  const existingToken = await getIdempotentResponse(token, scope);
  if (existingToken?.responseJson) {
    return NextResponse.json(existingToken.responseJson);
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: true
    }
  });
  if (!batch) {
    return jsonError("Import batch not found.", 404);
  }
  if (batch.status === ImportBatchStatus.COMMITTED) {
    return NextResponse.json({ summary: "Batch already committed." });
  }

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of batch.rows) {
      if (row.action === ImportRowAction.ERROR || !row.partNumber || !row.name) {
        continue;
      }

      const existing = await tx.part.findUnique({
        where: {
          projectId_partNumber: {
            projectId: batch.projectId,
            partNumber: row.partNumber
          }
        }
      });

      if (!existing && row.action === ImportRowAction.CREATE) {
        const newPart = await tx.part.create({
          data: {
            projectId: batch.projectId,
            partNumber: row.partNumber,
            name: row.name,
            quantityRequired: row.quantityNeeded ?? 1,
            status: PartStatus.DESIGNED
          }
        });
        await tx.partEvent.create({
          data: {
            partId: newPart.id,
            actorUserId: userResult,
            eventType: PartEventType.IMPORTED,
            payloadJson: { batchId: batch.id, action: "CREATE" }
          }
        });
        created += 1;
        continue;
      }

      if (existing && row.action === ImportRowAction.UPDATE) {
        await tx.part.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            quantityRequired: row.quantityNeeded ?? existing.quantityRequired
          }
        });
        await tx.partEvent.create({
          data: {
            partId: existing.id,
            actorUserId: userResult,
            eventType: PartEventType.IMPORTED,
            payloadJson: { batchId: batch.id, action: "UPDATE" }
          }
        });
        updated += 1;
      }
    }

    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: ImportBatchStatus.COMMITTED,
        completedAt: new Date()
      }
    });
  });

  const payload = {
    summary: `Committed batch: ${created} created, ${updated} updated.`
  };
  await storeIdempotentResponse(token, scope, payload);
  return NextResponse.json(payload);
}
