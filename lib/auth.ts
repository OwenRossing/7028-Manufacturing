import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const DEMO_COOKIE_NAME = process.env.DEMO_SESSION_COOKIE ?? "demo_user_id";

export function getUserIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(DEMO_COOKIE_NAME)?.value ?? null;
}

export async function getUserIdFromCookieStore(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_COOKIE_NAME)?.value ?? null;
}
