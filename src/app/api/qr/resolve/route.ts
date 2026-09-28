import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRequestPayable, resolveRequestPayload } from "@/lib/payments/requests";

const bodySchema = z.object({ payload: z.string().min(1).max(2000) });

function parsePayload(payload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a scanned QR payload to merchant info.
 * Accepts a merchant QR ({type:"merchant", merchantId:"CUPI-MER-…"}), a bare
 * payment ID (CUPI-MER-000542), or a merchant charge request
 * ({type:"request", token:"…"} / CUPI-REQ-XXXXXX).
 */
export async function POST(req: Request) {
  try {
    await requireRole(["EMPLOYEE"]);
    const { payload } = bodySchema.parse(await req.json());
    const parsed = parsePayload(payload);

    // ── Merchant charge request: amount is locked by the merchant ──
    const isRequest = parsed?.type === "request" || typeof parsed?.token === "string" || /^CUPI-REQ-/i.test(payload.trim());
    if (isRequest) {
      const request = await resolveRequestPayload(payload);
      if (!request) {
        return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
      }
      if (request.merchant.status !== "ACTIVE") {
        return NextResponse.json({ error: "Merchant is inactive" }, { status: 404 });
      }
      const payable = checkRequestPayable(request, request.merchant.id, request.amount);
      return NextResponse.json({
        merchant: {
          id: request.merchant.id,
          paymentId: request.merchant.paymentId,
          businessName: request.merchant.businessName,
          category: request.merchant.category,
          city: request.merchant.city,
          status: request.merchant.status,
        },
        request: {
          id: request.id,
          code: request.code,
          token: request.token,
          amount: request.amount,
          currency: request.currency,
          purpose: request.purpose,
          status: request.status,
          expiresAt: request.expiresAt,
          payable: payable.ok,
          reason: payable.ok ? null : payable.message,
        },
      });
    }

    let paymentId = payload.trim();
    if (parsed && parsed.type === "merchant" && typeof parsed.merchantId === "string") {
      paymentId = parsed.merchantId;
    }

    const merchant = await prisma.merchant.findUnique({
      where: { paymentId },
      select: { id: true, paymentId: true, businessName: true, category: true, city: true, status: true },
    });
    if (!merchant || merchant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Merchant not found or inactive" }, { status: 404 });
    }
    return NextResponse.json({ merchant });
  } catch (err) {
    return handleApiError(err);
  }
}
