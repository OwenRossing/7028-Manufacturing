import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson } from "@/lib/api";
import { setAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/app-mode";

const schema = z.object({
  userId: z.string().min(1)
});

export async function GET() {
  if (!isDemoMode()) {
    return jsonError("Demo login is disabled in production mode.", 410);
  }

  const users = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
    take: 20,
    select: { id: true, displayName: true, email: true }
  });
  return NextResponse.json({ items: users });
}

export async function POST(request: NextRequest) {
  if (!isDemoMode()) {
    return jsonError("Demo login is disabled in production mode.", 410);
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true }
  });
  if (!user) return jsonError("Demo user not found.", 404);

  const response = NextResponse.json({ ok: true, userId: user.id });
  setAuthCookie(response, user.id);
  return response;
}
