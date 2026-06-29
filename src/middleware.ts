import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Guest period view is always public
  if (pathname === "/p" || pathname.startsWith("/p/")) return NextResponse.next();

  // Root route: guests go to /p, logged in users go to /dashboard
  if (pathname === "/") {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.redirect(new URL("/p", req.url));
  }

  // Auth routes are accessible when logged out
  if (pathname === "/login") {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // Everything else requires authentication
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
