import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken, tokensMatch } from "../../../lib/session.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function GET(request) {
  const password = process.env.DASHBOARD_PASSWORD || "";
  if (!password) return NextResponse.json({ restricted: false });
  const cookie = request.cookies.get(SESSION_COOKIE)?.value || "";
  return NextResponse.json({
    restricted: true,
    signedIn: tokensMatch(cookie, sessionToken(password)),
  });
}

export async function POST(request) {
  const password = process.env.DASHBOARD_PASSWORD || "";
  if (!password) {
    return NextResponse.json(
      { error: "This server has no dashboard passphrase." },
      { status: 400 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const attempt = typeof body.password === "string" ? body.password : "";
  if (!tokensMatch(sessionToken(attempt), sessionToken(password))) {
    return NextResponse.json({ error: "Wrong passphrase." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken(password), cookieOptions(60 * 60 * 24 * 30));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
