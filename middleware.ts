import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = process.env.DEMO_SESSION_COOKIE ?? "demo_session_id";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/google",
  "/api/auth/demo-login",
  "/api/auth/local-login",
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

  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!hasSession) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"]
};
