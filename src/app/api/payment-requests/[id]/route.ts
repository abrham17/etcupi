import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { buildRequestPayload, cancelPaymentRequest, expireStaleRequests, getMerchantForUser } from "@/lib/payments/requests";
import { prisma } from "@/lib/prisma";

/** Poll a single charge request (used by the merchant "Receive Payment" screen). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["MERCHANT"]);
    const merchant = await getMerchantForUser(user.id);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    const { id } = await params;
    await expireStaleRequests(merchant.id);

    const request = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { tx: { select: { reference: true, status: true, senderLabel: true } } },
    });
    if (!request || request.merchantId !== merchant.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      request: {
        id: request.id,
        token: request.token,
        code: request.code,
        amount: request.amount,
        currency: request.currency,
        purpose: request.purpose,
        status: request.status,
        expiresAt: request.expiresAt,
        paidAt: request.paidAt,
        createdAt: request.createdAt,
        txId: request.txId,
        txReference: request.tx?.reference ?? null,
        txStatus: request.tx?.status ?? null,
        senderLabel: request.tx?.senderLabel ?? null,
        payload: buildRequestPayload({
          token: request.token,
          paymentId: merchant.paymentId,
          businessName: merchant.businessName,
          amount: request.amount,
          purpose: request.purpose,
        }),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Cancel an open request (mis-typed amount, customer walked away). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["MERCHANT"]);
    const merchant = await getMerchantForUser(user.id);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    const { id } = await params;

    try {
      const request = await cancelPaymentRequest(id, merchant.id);
      await audit({
        actorId: user.id,
        action: "PAYMENT_REQUEST_CANCELLED",
        entity: "PaymentRequest",
        entityId: id,
        metadata: { code: request.code },
      });
      return NextResponse.json({ ok: true, request });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Could not cancel" }, { status: 400 });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
