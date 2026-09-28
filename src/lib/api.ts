import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";
import { PaymentError } from "@/lib/payments/errors";

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Wrap an API handler with uniform error mapping. */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    return jsonError(first?.message ?? "Invalid input", 422, "VALIDATION");
  }
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status, err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
  }
  if (err instanceof PaymentError) {
    return NextResponse.json(
      { error: err.message, code: err.code, approvalId: err.approvalId },
      { status: err.status }
    );
  }
  console.error("[api] unexpected error:", err);
  return jsonError("Internal server error", 500, "INTERNAL");
}

export function parseJson<T>(req: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }) {
  return req.json().then((body) => {
    const res = schema.safeParse(body);
    if (!res.success) {
      throw res.error;
    }
    return res.data;
  });
}
