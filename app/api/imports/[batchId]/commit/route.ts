import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { commitImportBatch } from "@/lib/imports/commit-batch";
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

  const commit = await commitImportBatch({
    prisma,
    batchId,
    actorUserId: userResult
  });

  const payload = {
    summary: commit.alreadyCommitted
      ? "Batch already committed."
      : `Committed batch: ${commit.created} created, ${commit.updated} updated.`
  };
  await storeIdempotentResponse(token, scope, payload);
  return NextResponse.json(payload);
}
