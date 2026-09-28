import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { login } from "@/lib/auth/cookies";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/audit";
import { jsonError } from "@/lib/api";
import { ZodError } from "zod";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) return jsonError("Too many attempts. Try again later.", 429, "RATE_LIMITED");

  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);
    const result = await login(email, password);
    if (!result) return jsonError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    if ("suspended" in result) return jsonError("Your account is suspended", 403, "SUSPENDED");

    const dest =
      result.role === "SUPER_ADMIN" ? "/admin"
      : result.role === "MERCHANT" ? "/merchant"
      : result.role === "EMPLOYEE" ? "/employee"
      : "/dashboard";
    return NextResponse.json({ ok: true, role: result.role, redirect: dest });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Invalid input", 422, "VALIDATION");
    return jsonError("Internal server error", 500);
  }
}
