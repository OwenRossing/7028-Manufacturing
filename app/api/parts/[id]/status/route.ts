import { PartEventType, PartStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canTransition } from "@/lib/status";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { canManagePart, editorContext } from "@/lib/permissions";

const schema = z.object({
  toStatus: z.nativeEnum(PartStatus),
  note: z.string().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const token = request.headers.get("x-idempotency-key");
  const scope = `status:${id}`;
  const existingToken = await getIdempotentResponse(token, scope);
  if (existingToken?.responseJson) {
    return NextResponse.json(existingToken.responseJson);
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      photos: { select: { id: true }, take: 1 }
    }
  });
  if (!part) {
    return jsonError("Part not found.", 404);
  }
  if (!(await canManagePart(userResult, id))) {
    return jsonError("You do not have permission to update this part status.", 403);
  }
  if (!canTransition(part.status, parsed.data.toStatus)) {
    return jsonError("Invalid status transition.", 400);
  }

  if (parsed.data.toStatus === PartStatus.DONE && part.photos.length === 0) {
    return jsonError("At least one photo is required before setting status to DONE.", 400);
  }
  const context = await editorContext(userResult, id);

  await prisma.part.update({
    where: { id },
    data: { status: parsed.data.toStatus }
  });

  await prisma.partEvent.create({
    data: {
      partId: id,
      actorUserId: userResult,
      eventType: PartEventType.STATUS_CHANGED,
      fromStatus: part.status,
      toStatus: parsed.data.toStatus,
      payloadJson: parsed.data.note ? { note: parsed.data.note, editor: context } : { editor: context }
    }
  });

  const responsePayload = await prisma.part.findUnique({
    where: { id },
    include: {
      owners: { include: { user: true }, orderBy: { role: "asc" } },
      photos: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (!responsePayload) {
    return jsonError("Part not found after update.", 404);
  }
  await storeIdempotentResponse(token, scope, responsePayload);
  return NextResponse.json(responsePayload);
}
