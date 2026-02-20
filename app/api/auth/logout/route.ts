import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearAuthCookie, revokeAuthSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  await revokeAuthSession(request);
  clearAuthCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  await revokeAuthSession(request);
  clearAuthCookie(response);
  return response;
}
