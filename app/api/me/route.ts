import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const [user, isAdmin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userResult },
      select: { id: true, displayName: true }
    }),
    isAdminUser(userResult)
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    displayName: user.displayName,
    isAdmin
  });
}
