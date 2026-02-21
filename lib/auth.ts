import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const AUTH_COOKIE_NAME = env.DEMO_SESSION_COOKIE;
const SESSION_TTL_SECONDS = env.SESSION_TTL_SECONDS;

type SessionUserRecord = { id: string };
type SessionRecord = {
  id: string;
  expiresAt: Date;
  user: SessionUserRecord;
};

type SessionModel = {
  findUnique(args: unknown): Promise<SessionRecord | null>;
  delete(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
};

const sessionModel = (prisma as unknown as { session: SessionModel }).session;

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
  const session = await sessionModel.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true } } }
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await sessionModel.delete({ where: { id: sessionId } }).catch(() => undefined);
    return null;
  }

  await sessionModel
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
  await sessionModel.create({
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
  await sessionModel.delete({ where: { id: sessionId } }).catch(() => undefined);
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  return validateSession(getSessionIdFromRequest(request));
}

export async function getUserIdFromCookieStore(): Promise<string | null> {
  return validateSession(await getSessionIdFromCookieStore());
}
