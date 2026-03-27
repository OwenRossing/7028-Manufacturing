import { PartEventType, PartStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { PART_NUMBER_REGEX, partNumberHint } from "@/lib/part-number";
import { canManagePart, editorContext, isAdminUser } from "@/lib/permissions";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  partNumber: z.string().regex(PART_NUMBER_REGEX, partNumberHint()).optional(),
  description: z.string().nullable().optional(),
  quantityRequired: z.number().int().min(1).optional(),
  quantityComplete: z.number().int().min(0).optional(),
  priority: z.number().int().min(1).max(5).optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      owners: { include: { user: true } },
      photos: { orderBy: { createdAt: "desc" }, take: 100 }
    }
  });
  if (!part) {
    return jsonError("Part not found.", 404);
  }
  return NextResponse.json(part);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  const { id } = await params;
  const parsed = await parseJson(request, patchSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const existing = await prisma.part.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("Part not found.", 404);
  }
  if (!(await canManagePart(userResult, id))) {
    return jsonError(
      "Permission denied: you must be assigned to this part or be an admin to edit it.",
      403
    );
  }
  const context = await editorContext(userResult, id);

  const nextData: {
    name?: string;
    partNumber?: string;
    description?: string | null;
    quantityRequired?: number;
    quantityComplete?: number;
    priority?: number;
    status?: PartStatus;
  } = { ...parsed.data };
  if (nextData.quantityRequired !== undefined && nextData.quantityComplete !== undefined) {
    if (nextData.quantityComplete > nextData.quantityRequired) {
      return jsonError(
        `Invalid quantity: completed (${nextData.quantityComplete}) cannot exceed required (${nextData.quantityRequired}).`,
        400
      );
    }
  } else if (
    nextData.quantityRequired !== undefined &&
    nextData.quantityComplete === undefined &&
    existing.quantityComplete > nextData.quantityRequired
  ) {
    return jsonError(
      `Invalid quantity: required cannot be less than already completed (${existing.quantityComplete}).`,
      400
    );
  }

  const targetRequired = nextData.quantityRequired ?? existing.quantityRequired;
  const targetComplete = nextData.quantityComplete ?? existing.quantityComplete;
  const currentStatus = existing.status;

  // Stage auto-transitions driven by quantity changes (never modify quantity here)
  if (nextData.quantityComplete !== undefined) {
    if (targetComplete >= targetRequired) {
      const hasPhoto = await prisma.partPhoto.findFirst({
        where: { partId: id },
        select: { id: true }
      });
      if (!hasPhoto) {
        return jsonError(
          "Cannot complete all quantity: please upload at least one photo first.",
          400
        );
      }
      // Advance to DONE
      if (currentStatus !== PartStatus.DONE) {
        nextData.status = PartStatus.DONE;
      }
    } else if (currentStatus === PartStatus.DONE) {
      // Quantity dropped below required — revert from DONE to IN_PROGRESS
      nextData.status = PartStatus.MACHINED;
    } else if (targetComplete > 0 && currentStatus === PartStatus.DESIGNED) {
      // First quantity added while in DESIGNED (assigned or unassigned) — start IN_PROGRESS
      nextData.status = PartStatus.MACHINED;
    }
  }

  const updated = await prisma.part.update({
    where: { id },
    data: nextData,
    include: {
      owners: { include: { user: true }, orderBy: { role: "asc" } },
      photos: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  await prisma.partEvent.create({
    data: {
      partId: id,
      actorUserId: userResult,
      eventType: PartEventType.UPDATED,
      payloadJson: {
        ...nextData,
        editor: context
      }
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const existing = await prisma.part.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return jsonError("Part not found.", 404);
  }
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required to delete parts.", 403);
  }

  await prisma.part.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
