import { PartEventType, PartOwnerRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePart, editorContext } from "@/lib/permissions";

const schema = z.object({
  primaryOwnerId: z.string().nullable(),
  collaboratorIds: z.array(z.string()).default([])
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { id } = await params;
  const part = await prisma.part.findUnique({ where: { id }, select: { id: true } });
  if (!part) {
    return jsonError("Part not found.", 404);
  }
  if (!(await canManagePart(userResult, id))) {
    return jsonError("You do not have permission to manage roles for this part.", 403);
  }
  const context = await editorContext(userResult, id);

  const collaboratorIds = [...new Set(parsed.data.collaboratorIds)];

  if (
    parsed.data.primaryOwnerId &&
    collaboratorIds.includes(parsed.data.primaryOwnerId)
  ) {
    return jsonError("Machinist cannot also be listed as a finisher.", 400);
  }

  const updatedPart = await prisma.$transaction(async (tx) => {
    await tx.partOwner.deleteMany({ where: { partId: id } });

    const createData = [];
    if (parsed.data.primaryOwnerId) {
      createData.push({
        partId: id,
        userId: parsed.data.primaryOwnerId,
        role: PartOwnerRole.PRIMARY
      });
    }
    for (const collaboratorId of collaboratorIds) {
      createData.push({
        partId: id,
        userId: collaboratorId,
        role: PartOwnerRole.COLLABORATOR
      });
    }

    if (createData.length > 0) {
      await tx.partOwner.createMany({ data: createData });
    }

    await tx.partEvent.create({
      data: {
        partId: id,
        actorUserId: userResult,
        eventType: PartEventType.OWNERS_CHANGED,
        payloadJson: {
          primaryOwnerId: parsed.data.primaryOwnerId,
          collaboratorIds,
          editor: context
        }
      }
    });

    return tx.part.findUnique({
      where: { id },
      include: {
        owners: { include: { user: true }, orderBy: { role: "asc" } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
  });

  return NextResponse.json(updatedPart);
}
