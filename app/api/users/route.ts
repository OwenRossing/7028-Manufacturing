import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";
import { isAdminUser } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  const isAdmin = await isAdminUser(userResult);

  const items = await prisma.user.findMany({
    select: { id: true, displayName: true, ...(isAdmin ? { email: true } : {}) },
    orderBy: { displayName: "asc" }
  });
  return NextResponse.json({ items });
}
