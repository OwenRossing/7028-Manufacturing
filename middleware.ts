import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/google",
  "/api/auth/demo-login",
  "/api/auth/logout",
  "/_next",
  "/favicon.ico",
  "/uploads"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(DEMO_COOKIE_NAME)?.value);
  if (!hasSession) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"]
};
