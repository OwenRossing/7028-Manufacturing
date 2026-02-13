import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

export async function GET(request: NextRequest) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const items = await prisma.user.findMany({
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" }
  });
  return NextResponse.json({ items });
}
