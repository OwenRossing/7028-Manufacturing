import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const AUTH_COOKIE_NAME = process.env.DEMO_SESSION_COOKIE ?? "demo_session_id";
const SESSION_TTL_SECONDS = Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "", 10) || 60 * 60 * 24 * 14;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

async function getSessionIdFromCookieStore(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

async function validateSession(sessionId: string | null): Promise<string | null> {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true } } }
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    return null;
  }

  await prisma.session
    .update({
      where: { id: sessionId },
      data: { lastSeenAt: now }
    })
    .catch(() => undefined);

  return session.user.id;
}

export async function createAuthSession(
  response: NextResponse,
  userId: string,
  userAgent?: string | null
): Promise<void> {
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_SECONDS * 1000);
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 512) ?? null
    }
  });
  setSessionCookie(response, sessionId);
}

export async function revokeAuthSession(request: NextRequest): Promise<void> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  return validateSession(getSessionIdFromRequest(request));
}

export async function getUserIdFromCookieStore(): Promise<string | null> {
  return validateSession(await getSessionIdFromCookieStore());
}
