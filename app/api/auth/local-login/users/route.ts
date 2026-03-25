import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isLocalMode } from "@/lib/app-mode";

const schema = z.object({
  key: z.string().min(1)
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

  const users = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, email: true }
  });

  return NextResponse.json({ items: users });
}
