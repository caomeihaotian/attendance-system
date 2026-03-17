import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Protect teacher routes
  if (pathname.startsWith("/teacher")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "TEACHER") {
      return NextResponse.redirect(new URL("/student/dashboard", req.url));
    }
  }

  // Protect student routes
  if (pathname.startsWith("/student")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "STUDENT") {
      return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
    }
  }

  // Redirect authenticated users away from login
  if (pathname === "/login" && isLoggedIn) {
    if (role === "TEACHER") {
      return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/student/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
