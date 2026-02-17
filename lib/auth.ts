import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const DEMO_COOKIE_NAME = process.env.DEMO_SESSION_COOKIE ?? "demo_user_id";
const SESSION_TTL_SECONDS = Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "", 10) || 60 * 60 * 24 * 14;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookie(response: NextResponse, userId: string): void {
  response.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: userId,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(DEMO_COOKIE_NAME)?.value ?? null;
}

export async function getUserIdFromCookieStore(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_COOKIE_NAME)?.value ?? null;
}
