import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePart } from "@/lib/permissions";
import { getPartThumbnail, setPartThumbnail } from "@/lib/part-thumbnails";

const schema = z.object({
  storageKey: z.string().min(1).nullable()
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
  const part = await prisma.part.findUnique({ where: { id }, select: { id: true } });
  if (!part) {
    return jsonError("Part not found.", 404);
  }
  if (!(await canManagePart(userResult, id))) {
    return jsonError("You do not have permission to update thumbnail for this part.", 403);
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.storageKey) {
    const photo = await prisma.partPhoto.findFirst({
      where: { partId: id, storageKey: parsed.data.storageKey },
      select: { id: true }
    });
    if (!photo) {
      return jsonError("Selected media does not belong to this part.", 400);
    }
  }

  await setPartThumbnail(id, parsed.data.storageKey);
  const current = await getPartThumbnail(id);
  return NextResponse.json({ storageKey: current });
}
