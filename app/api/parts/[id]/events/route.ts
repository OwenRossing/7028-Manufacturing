import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const part = await prisma.part.findUnique({ where: { id }, select: { id: true } });
  if (!part) {
    return jsonError("Part not found.", 404);
  }

  const events = await prisma.partEvent.findMany({
    where: { partId: id },
    include: { actor: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ items: events });
}
