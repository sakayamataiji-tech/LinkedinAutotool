import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "la_session";
const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * Lightweight auth gate. Runs on the edge, so it only checks for the presence
 * of a session cookie — the authoritative check (validity, expiry, membership)
 * happens server-side in requireAuth(). Unauthenticated users are redirected
 * to /login; authenticated users are kept out of the auth pages.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Guard everything except Next internals, API routes, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
