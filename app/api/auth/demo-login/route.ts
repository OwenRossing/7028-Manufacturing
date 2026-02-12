import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_COOKIE_NAME } from "@/lib/auth";
import { jsonError, parseJson } from "@/lib/api";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, schema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });
  if (!user) {
    return jsonError("No demo user found for that email.", 404);
  }

  const response = NextResponse.json({ ok: true, userId: user.id });
  response.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: user.id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
  return response;
}
