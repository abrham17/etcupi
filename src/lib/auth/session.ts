import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get("etcupi_session")?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const { verifyToken } = await import("./jwt");
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, fullName: true, role: true, status: true, companyId: true },
  });
  if (!user || user.status === "SUSPENDED") return null;
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    companyId: user.companyId,
  };
}

/** Require an authenticated user; returns the user or throws NextResponse. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError("UNAUTHORIZED", 401);
  return u;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new AuthError("FORBIDDEN", 403);
  return u;
}

export async function requireCompanyAdmin(): Promise<SessionUser> {
  return requireRole(["COMPANY_ADMIN"]);
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireRole(["SUPER_ADMIN"]);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

// ── Company membership helpers ───────────────────────────────

/** For COMPANY_ADMIN / FINANCE_MANAGER / EMPLOYEE, ensures the session user's company. */
export async function requireCompanyId(): Promise<string> {
  const u = await requireUser();
  if (u.role === "SUPER_ADMIN") throw new AuthError("FORBIDDEN", 403);
  if (!u.companyId) throw new AuthError("FORBIDDEN", 403);
  return u.companyId;
}
