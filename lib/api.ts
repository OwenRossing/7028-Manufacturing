import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/auth";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(request: NextRequest): Promise<string | NextResponse> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }
  return userId;
}

export async function parseJson<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(parsed.error.issues[0]?.message ?? "Invalid request payload", 400)
    };
  }
  return { ok: true, data: parsed.data };
}
