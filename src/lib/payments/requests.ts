// ── Merchant payment requests ────────────────────────────────
// A merchant asks to be paid an exact amount: "Receive Payment" on the merchant
// app creates a PaymentRequest, renders it as a QR / short code, and the payer
// (employee app) scans or types it. The amount is locked on the request so the
// merchant always receives precisely what was charged.

import { prisma } from "@/lib/prisma";
import { generateRequestCode, generateToken } from "@/lib/ids";
import { formatBirr } from "@/lib/money";

export const DEFAULT_REQUEST_TTL_MINUTES = 15;
export const MAX_REQUEST_TTL_MINUTES = 24 * 60;

export interface RequestMerchant {
  id: string;
  paymentId: string;
  businessName: string;
  category: string;
  city: string;
  status: string;
}

export interface RequestView {
  id: string;
  merchantId: string;
  token: string;
  code: string;
  amount: bigint;
  currency: string;
  purpose: string;
  status: string;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  txId: string | null;
  txReference: string | null;
  txStatus: string | null;
  senderLabel: string | null;
  merchant: RequestMerchant;
}

/** Payload the payer scans. Doubles as a human-readable QR for any other scanner. */
export function buildRequestPayload(req: {
  token: string;
  paymentId: string;
  businessName: string;
  amount: bigint;
  purpose: string;
}): string {
  return JSON.stringify({
    type: "request",
    token: req.token,
    merchantId: req.paymentId,
    currency: "ETB",
    amount: Number(req.amount) / 100,
    amountMinor: req.amount.toString(),
    purpose: req.purpose,
    name: req.businessName,
  });
}

export async function getMerchantForUser(userId: string) {
  return prisma.merchant.findUnique({
    where: { userId },
    select: { id: true, paymentId: true, businessName: true, category: true, city: true, status: true },
  });
}

/** Mark OPEN requests past their expiry as EXPIRED. Called before reads. */
export async function expireStaleRequests(merchantId?: string): Promise<number> {
  const res = await prisma.paymentRequest.updateMany({
    where: {
      status: "OPEN",
      expiresAt: { not: null, lt: new Date() },
      ...(merchantId ? { merchantId } : {}),
    },
    data: { status: "EXPIRED" },
  });
  return res.count;
}

export async function createPaymentRequest(input: {
  merchant: RequestMerchant;
  amount: bigint;
  purpose: string;
  ttlMinutes?: number;
}): Promise<RequestView> {
  const ttl = Math.min(Math.max(input.ttlMinutes ?? DEFAULT_REQUEST_TTL_MINUTES, 1), MAX_REQUEST_TTL_MINUTES);
  const request = await prisma.paymentRequest.create({
    data: {
      merchantId: input.merchant.id,
      token: generateToken(),
      code: generateRequestCode(),
      amount: input.amount,
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + ttl * 60_000),
    },
  });
  return {
    ...request,
    txReference: null,
    txStatus: null,
    senderLabel: null,
    merchant: input.merchant,
  };
}

/** Look up a request by its token, its short code, or a full JSON QR payload. */
export async function resolveRequestPayload(payload: string): Promise<RequestView | null> {
  let identifier = payload.trim();
  try {
    const parsed = JSON.parse(payload) as { type?: string; token?: string; code?: string };
    if (parsed && typeof parsed === "object") {
      if (parsed.type === "request" && typeof parsed.token === "string") identifier = parsed.token;
      else if (typeof parsed.token === "string") identifier = parsed.token;
      else if (typeof parsed.code === "string") identifier = parsed.code;
    }
  } catch {
    // not JSON — treat as a bare token or CUPI-REQ- code
  }
  if (!identifier) return null;

  const request = await prisma.paymentRequest.findFirst({
    where: { OR: [{ token: identifier }, { code: identifier.toUpperCase() }] },
    include: { merchant: true, tx: { select: { reference: true, status: true, senderLabel: true } } },
  });
  if (!request) return null;

  if (request.status === "OPEN" && request.expiresAt && request.expiresAt < new Date()) {
    await prisma.paymentRequest.update({ where: { id: request.id }, data: { status: "EXPIRED" } });
    request.status = "EXPIRED";
  }

  return {
    ...request,
    txReference: request.tx?.reference ?? null,
    txStatus: request.tx?.status ?? null,
    senderLabel: request.tx?.senderLabel ?? null,
    merchant: {
      id: request.merchant.id,
      paymentId: request.merchant.paymentId,
      businessName: request.merchant.businessName,
      category: request.merchant.category,
      city: request.merchant.city,
      status: request.merchant.status,
    },
  };
}

export async function listMerchantRequests(merchantId: string, take = 20): Promise<RequestView[]> {
  await expireStaleRequests(merchantId);
  const rows = await prisma.paymentRequest.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take,
    include: { merchant: true, tx: { select: { reference: true, status: true, senderLabel: true } } },
  });
  return rows.map((request) => ({
    ...request,
    txReference: request.tx?.reference ?? null,
    txStatus: request.tx?.status ?? null,
    senderLabel: request.tx?.senderLabel ?? null,
    merchant: {
      id: request.merchant.id,
      paymentId: request.merchant.paymentId,
      businessName: request.merchant.businessName,
      category: request.merchant.category,
      city: request.merchant.city,
      status: request.merchant.status,
    },
  }));
}

export async function cancelPaymentRequest(id: string, merchantId: string): Promise<RequestView> {
  const request = await prisma.paymentRequest.findUnique({ where: { id }, include: { merchant: true } });
  if (!request || request.merchantId !== merchantId) {
    throw new Error("Payment request not found");
  }
  if (request.status !== "OPEN") {
    throw new Error("Only an open request can be cancelled");
  }
  const updated = await prisma.paymentRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { merchant: true },
  });
  return {
    ...updated,
    txReference: null,
    txStatus: null,
    senderLabel: null,
    merchant: {
      id: updated.merchant.id,
      paymentId: updated.merchant.paymentId,
      businessName: updated.merchant.businessName,
      category: updated.merchant.category,
      city: updated.merchant.city,
      status: updated.merchant.status,
    },
  };
}

export type PayableCheck = { ok: true } | { ok: false; message: string };

/**
 * Guard used by the payment engine: a request must be OPEN, unexpired, belong to
 * the merchant being paid, and be paid for exactly the requested amount.
 */
export function checkRequestPayable(
  request: { status: string; expiresAt: Date | null; amount: bigint; merchantId: string },
  merchantId: string,
  amount: bigint
): PayableCheck {
  if (request.merchantId !== merchantId) return { ok: false, message: "This request belongs to a different merchant" };
  if (request.status === "PAID") return { ok: false, message: "This payment request has already been paid" };
  if (request.status === "CANCELLED") return { ok: false, message: "This payment request was cancelled" };
  if (request.status === "EXPIRED") return { ok: false, message: "This payment request has expired — ask for a new one" };
  if (request.status === "AWAITING_APPROVAL") {
    return { ok: false, message: "This request is already awaiting approval" };
  }
  if (request.expiresAt && request.expiresAt < new Date()) {
    return { ok: false, message: "This payment request has expired — ask for a new one" };
  }
  if (request.amount !== amount) {
    return { ok: false, message: `This request must be paid exactly ${formatBirr(request.amount)} ETB` };
  }
  return { ok: true };
}

/**
 * Move the request linked to a transaction into its new state:
 * AWAITING_APPROVAL while parked for approval, PAID once money has moved, and
 * OPEN again when an approval is rejected so the payer can retry.
 */
export async function applyRequestTxState(
  db: Pick<typeof prisma, "paymentRequest">,
  txId: string,
  status: "OPEN" | "AWAITING_APPROVAL" | "PAID",
  /** The request being settled; omit when it is already linked by txId. */
  requestId?: string
): Promise<void> {
  const request = requestId
    ? await db.paymentRequest.findUnique({ where: { id: requestId } })
    : await db.paymentRequest.findUnique({ where: { txId } });
  if (!request) return;
  await db.paymentRequest.update({
    where: { id: request.id },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : null,
      txId: status === "OPEN" ? null : txId,
    },
  });
}
