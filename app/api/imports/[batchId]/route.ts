import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { batchId } = await params;
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" }
      }
    }
  });
  if (!batch) {
    return jsonError("Import batch not found.", 404);
  }
  const isAdmin = await isAdminUser(userResult);
  if (!isAdmin && batch.startedById !== userResult) {
    return jsonError("You do not have permission to view this import batch.", 403);
  }

  return NextResponse.json(batch);
}
