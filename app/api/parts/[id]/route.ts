import { PartEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { PART_NUMBER_REGEX, partNumberHint } from "@/lib/part-number";

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
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      owners: { include: { user: true } },
      photos: { orderBy: { createdAt: "desc" }, take: 10 }
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
  const userResult = requireUser(request);
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

  const updated = await prisma.part.update({
    where: { id },
    data: parsed.data,
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
      payloadJson: parsed.data
    }
  });

  return NextResponse.json(updated);
}
