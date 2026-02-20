import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseJson } from "@/lib/api";
import { createAuthSession } from "@/lib/auth";

const schema = z.object({
  credential: z.string().min(1)
});

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: "true" | "false";
  given_name?: string;
  name?: string;
  picture?: string;
};
const ALLOWED_DOMAIN = "stmarobotics.org";

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!expectedClientId) {
    return jsonError("Google sign-in is not configured.", 503);
  }

  const verifyResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.credential)}`,
    { cache: "no-store" }
  );
  if (!verifyResponse.ok) {
    return jsonError("Invalid Google credential.", 401);
  }
  const tokenInfo = (await verifyResponse.json()) as GoogleTokenInfo;
  if (tokenInfo.aud !== expectedClientId) {
    return jsonError("Google credential audience mismatch.", 401);
  }
  if (!tokenInfo.email || tokenInfo.email_verified !== "true") {
    return jsonError("Google email is missing or not verified.", 401);
  }

  const email = tokenInfo.email.toLowerCase();
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return jsonError(`Only @${ALLOWED_DOMAIN} Google accounts are allowed.`, 403);
  }
  const displayName = tokenInfo.name?.trim() || tokenInfo.given_name?.trim() || email.split("@")[0];
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      avatarUrl: tokenInfo.picture ?? undefined
    },
    create: {
      email,
      displayName,
      avatarUrl: tokenInfo.picture ?? null
    }
  });

  const response = NextResponse.json({ ok: true, userId: user.id });
  await createAuthSession(response, user.id, request.headers.get("user-agent"));
  return response;
}
