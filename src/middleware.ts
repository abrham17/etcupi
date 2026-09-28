import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

const PUBLIC_PATHS = ["/", "/login", "/register", "/register/merchant", "/forgot-password"];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.includes(path) || path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register");
}

const ROLE_PREFIX: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  COMPANY_ADMIN: "/dashboard",
  FINANCE_MANAGER: "/dashboard",
  EMPLOYEE: "/employee",
  MERCHANT: "/merchant",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Security headers for every response
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self)");

  if (pathname.startsWith("/api")) {
    return res;
  }

  const token = req.cookies.get("etcupi_session")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (isPublic(pathname)) {
    // Signed-in users skip auth pages
    if (payload && (pathname === "/login" || pathname === "/register")) {
      const dest = ROLE_PREFIX[payload.role] ?? "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return res;
  }

  if (!payload) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-prefix enforcement
  const expected = ROLE_PREFIX[payload.role];
  if (expected && pathname.startsWith(expected)) {
    return res;
  }
  // Authenticated user on another role's area → send them home
  if (expected && !pathname.startsWith(expected)) {
    // Allow shared prefixes? None — areas are role-exclusive in this app.
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/employee") || pathname.startsWith("/merchant") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL(expected, req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
