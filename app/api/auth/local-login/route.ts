import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson } from "@/lib/api";
import { createAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isLocalMode } from "@/lib/app-mode";

const schema = z.object({
  key: z.string().min(1),
  userId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  if (!isLocalMode()) {
    return jsonError("Local login is not enabled.", 410);
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  if (!env.LOCAL_ENTRY_KEY || parsed.data.key !== env.LOCAL_ENTRY_KEY) {
    return jsonError("Invalid entry key.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true }
  });
  if (!user) return jsonError("User not found.", 404);

  const response = NextResponse.json({ ok: true, userId: user.id });
  await createAuthSession(response, user.id, request.headers.get("user-agent"));
  return response;
}
