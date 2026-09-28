import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { parseAmountToMinor } from "@/lib/money";
import { rateLimit } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/audit";
import {
  DEFAULT_REQUEST_TTL_MINUTES,
  MAX_REQUEST_TTL_MINUTES,
  buildRequestPayload,
  createPaymentRequest,
  getMerchantForUser,
  listMerchantRequests,
} from "@/lib/payments/requests";
import { z } from "zod";

const bodySchema = z.object({
  amount: z.union([z.string(), z.number()]),
  purpose: z.string().trim().min(2, "Add a short note for the payer").max(200),
  ttlMinutes: z.number().int().min(1).max(MAX_REQUEST_TTL_MINUTES).optional(),
});

/** The merchant's own charge requests, newest first. */
export async function GET() {
  try {
    const user = await requireRole(["MERCHANT"]);
    const merchant = await getMerchantForUser(user.id);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    const requests = await listMerchantRequests(merchant.id);
    return NextResponse.json({
      requests: requests.map((r) => ({ ...r, payload: buildRequestPayload({ ...r, paymentId: r.merchant.paymentId, businessName: r.merchant.businessName }) })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Charge an exact amount: creates the request the payer scans or types. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(["MERCHANT"]);
    const merchant = await getMerchantForUser(user.id);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    if (merchant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Your merchant account is suspended" }, { status: 403 });
    }

    const rl = rateLimit(`req:${user.id}`, 30, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });

    const body = bodySchema.parse(await req.json());
    const amount = parseAmountToMinor(body.amount);
    if (!amount || amount <= 0n) {
      return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
    }
    if (amount > 1_000_000_00n) {
      return NextResponse.json({ error: "Maximum single charge is 1,000,000 ETB" }, { status: 400 });
    }

    const request = await createPaymentRequest({
      merchant,
      amount,
      purpose: body.purpose,
      ttlMinutes: body.ttlMinutes ?? DEFAULT_REQUEST_TTL_MINUTES,
    });

    await audit({
      actorId: user.id,
      action: "PAYMENT_REQUEST_CREATED",
      entity: "PaymentRequest",
      entityId: request.id,
      metadata: { code: request.code, amount: request.amount.toString() },
    });

    return NextResponse.json(
      {
        request: {
          ...request,
          payload: buildRequestPayload({
            token: request.token,
            paymentId: merchant.paymentId,
            businessName: merchant.businessName,
            amount: request.amount,
            purpose: request.purpose,
          }),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
