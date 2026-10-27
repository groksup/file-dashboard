import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken, tokensMatch } from "./lib/session.js";

export function proxy(request) {
  const password = process.env.DASHBOARD_PASSWORD || "";
  if (!password) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value || "";
  if (tokensMatch(cookie, sessionToken(password))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = `${pathname}${search}`;
  if (next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
