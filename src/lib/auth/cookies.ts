import { prisma } from "@/lib/prisma";
import { signSessionToken } from "./jwt";
import type { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "etcupi_session";

export async function createSession(userId: string, role: UserRole): Promise<void> {
  const token = await signSessionToken({ sub: userId, role });
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Verify credentials and create the session. Returns user role for redirect. */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const { compare } = await import("bcryptjs");
  const ok = await compare(password, user.passwordHash);
  if (!ok) return null;
  if (user.status === "SUSPENDED") return { suspended: true as const };
  await createSession(user.id, user.role);
  return { role: user.role, name: user.fullName };
}
