import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePart } from "@/lib/permissions";

export async function GET(
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
    return jsonError("You do not have permission to view this part history.", 403);
  }

  const events = await prisma.partEvent.findMany({
    where: { partId: id },
    include: { actor: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ items: events });
}
