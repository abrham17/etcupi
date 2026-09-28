import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { initiatePayment, decideApproval } from "@/lib/payments/engine";
import { allocateToEmployee, topupCompanyWallet } from "@/lib/wallets/service";
import {
  buildRequestPayload,
  cancelPaymentRequest,
  checkRequestPayable,
  createPaymentRequest,
  expireStaleRequests,
  listMerchantRequests,
  resolveRequestPayload,
  type RequestMerchant,
} from "@/lib/payments/requests";
import { birr } from "@/lib/money";
import bcrypt from "bcryptjs";

let companyId: string;
let adminId: string;
let financeId: string;

let employeeUserId: string;
let employeeProfileId: string;
let employeeWalletId: string;

let merchant: RequestMerchant;
let merchantWalletId: string;
let otherMerchantId: string;

const CATEGORY = "Office Supplies";

async function walletBalance(walletId: string): Promise<bigint> {
  const w = await prisma.wallet.findUnique({ where: { id: walletId } });
  return w!.balance;
}

function newRequest(amountBirr: number, purpose = "Printing 200 flyers", ttlMinutes?: number) {
  return createPaymentRequest({ merchant, amount: birr(amountBirr), purpose, ttlMinutes });
}

function payRequest(amountBirr: number, requestId: string, opts: { merchantId?: string; idempotencyKey?: string } = {}) {
  return initiatePayment({
    employeeUserId,
    amount: birr(amountBirr),
    category: CATEGORY,
    purpose: "Printing 200 flyers",
    merchantId: opts.merchantId ?? merchant.id,
    requestId,
    idempotencyKey: opts.idempotencyKey,
  });
}

beforeAll(async () => {
  await prisma.paymentRequest.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.approvalRule.deleteMany();
  await prisma.spendingLimit.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await bcrypt.hash("testpass123", 4);

  const company = await prisma.company.create({
    data: { name: "Request Co", businessType: "IT", phone: "+251911000010", email: "req@test.et" },
  });
  companyId = company.id;

  const admin = await prisma.user.create({
    data: { email: "req-admin@test.et", passwordHash, fullName: "Request Admin", role: "COMPANY_ADMIN", companyId },
  });
  adminId = admin.id;
  const finance = await prisma.user.create({
    data: { email: "req-finance@test.et", passwordHash, fullName: "Request Finance", role: "FINANCE_MANAGER", companyId },
  });
  financeId = finance.id;

  await prisma.wallet.create({ data: { ownerType: "COMPANY", companyId, balance: 0n } });
  await prisma.spendingLimit.create({
    data: { companyId, name: "Default policy", dailyLimit: 0n, monthlyLimit: 0n, txLimit: 0n, blockedCategories: "", isDefault: true },
  });
  // Anything from 3,000 ETB up needs a finance manager
  await prisma.approvalRule.create({
    data: { companyId, minAmount: birr(3_000), maxAmount: null, approverRole: "FINANCE_MANAGER" },
  });

  const empUser = await prisma.user.create({
    data: { email: "req-emp@test.et", passwordHash, fullName: "Sara Request", role: "EMPLOYEE", companyId },
  });
  employeeUserId = empUser.id;
  const profile = await prisma.employeeProfile.create({
    data: {
      userId: empUser.id,
      companyId,
      employeeCode: "ETH-EMP-9101",
      paymentId: "CUPI-EMP-9101",
      monthlyLimit: birr(100_000),
      dailyLimit: birr(50_000),
      txLimit: birr(50_000),
    },
  });
  employeeProfileId = profile.id;
  const empWallet = await prisma.wallet.create({ data: { ownerType: "EMPLOYEE", employeeId: profile.id, balance: 0n } });
  employeeWalletId = empWallet.id;

  // Fund the company, then the employee wallet via the ledger
  await topupCompanyWallet(companyId, birr(100_000), adminId);
  await allocateToEmployee(companyId, employeeProfileId, birr(20_000), adminId);

  const merchantUser = await prisma.user.create({
    data: { email: "req-mer@test.et", passwordHash, fullName: "Print Shop", role: "MERCHANT" },
  });
  const m = await prisma.merchant.create({
    data: {
      userId: merchantUser.id,
      merchantCode: "ETH-MER-9101",
      paymentId: "CUPI-MER-9101",
      businessName: "Bole Print Shop",
      category: CATEGORY,
      phone: "+251911000011",
      city: "Addis Ababa",
    },
  });
  merchantWalletId = (
    await prisma.wallet.create({ data: { ownerType: "MERCHANT", merchantId: m.id, balance: 0n } })
  ).id;
  merchant = {
    id: m.id,
    paymentId: m.paymentId,
    businessName: m.businessName,
    category: m.category,
    city: m.city,
    status: m.status,
  };

  const otherUser = await prisma.user.create({
    data: { email: "req-mer2@test.et", passwordHash, fullName: "Other Shop", role: "MERCHANT" },
  });
  const other = await prisma.merchant.create({
    data: {
      userId: otherUser.id,
      merchantCode: "ETH-MER-9102",
      paymentId: "CUPI-MER-9102",
      businessName: "Other Shop",
      category: CATEGORY,
      phone: "+251911000012",
    },
  });
  otherMerchantId = other.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("merchant payment requests", () => {
  it("creates a charge and resolves it from the QR payload, token and short code", async () => {
    const request = await newRequest(250);
    expect(request.status).toBe("OPEN");
    expect(request.amount).toBe(birr(250));
    expect(request.code).toMatch(/^CUPI-REQ-/);
    expect(request.expiresAt!.getTime()).toBeGreaterThan(Date.now());

    const payload = buildRequestPayload({
      token: request.token,
      paymentId: merchant.paymentId,
      businessName: merchant.businessName,
      amount: request.amount,
      purpose: request.purpose,
    });
    const parsed = JSON.parse(payload);
    expect(parsed.type).toBe("request");
    expect(parsed.amountMinor).toBe("25000");
    expect(parsed.amount).toBe(250);

    const byPayload = await resolveRequestPayload(payload);
    expect(byPayload?.id).toBe(request.id);
    expect(byPayload?.amount).toBe(birr(250));
    expect(byPayload?.merchant.paymentId).toBe(merchant.paymentId);

    const byToken = await resolveRequestPayload(request.token);
    const byCode = await resolveRequestPayload(request.code.toLowerCase());
    expect(byToken?.id).toBe(request.id);
    expect(byCode?.id).toBe(request.id);

    expect(await resolveRequestPayload("CUPI-REQ-NOPE99")).toBeNull();
  });

  it("settles at the locked amount and links the transaction to the request", async () => {
    const request = await newRequest(250);
    const employeeBefore = await walletBalance(employeeWalletId);
    const merchantBefore = await walletBalance(merchantWalletId);

    const res = await payRequest(250, request.id);
    expect(res.status).toBe("COMPLETED");
    if (res.status !== "COMPLETED") return;

    expect(await walletBalance(employeeWalletId)).toBe(employeeBefore - birr(250));
    expect(await walletBalance(merchantWalletId)).toBe(merchantBefore + birr(250));

    const stored = await prisma.paymentRequest.findUnique({ where: { id: request.id } });
    expect(stored!.status).toBe("PAID");
    expect(stored!.txId).toBe(res.txId);
    expect(stored!.paidAt).not.toBeNull();

    const resolved = await resolveRequestPayload(request.token);
    expect(resolved?.txReference).toBe(res.reference);
    expect(resolved?.txStatus).toBe("COMPLETED");
    expect(resolved?.senderLabel).toBe("Sara Request");

    // Merchant was notified through the normal payment path
    const merchantUser = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    const notes = await prisma.notification.findMany({ where: { userId: merchantUser!.userId, type: "PAYMENT_RECEIVED" } });
    expect(notes.length).toBeGreaterThan(0);
  });

  it("refuses to pay a different amount than requested", async () => {
    const request = await newRequest(400);
    const employeeBefore = await walletBalance(employeeWalletId);
    const merchantBefore = await walletBalance(merchantWalletId);

    const res = await payRequest(300, request.id);
    expect(res.status).toBe("FAILED");
    if (res.status === "FAILED") {
      expect(res.code).toBe("REQUEST_NOT_PAYABLE");
      expect(res.message).toContain("400.00");
    }

    expect(await walletBalance(employeeWalletId)).toBe(employeeBefore);
    expect(await walletBalance(merchantWalletId)).toBe(merchantBefore);
    const stored = await prisma.paymentRequest.findUnique({ where: { id: request.id } });
    expect(stored!.status).toBe("OPEN");

    // The correct amount still goes through
    const ok = await payRequest(400, request.id);
    expect(ok.status).toBe("COMPLETED");
  });

  it("cannot settle a request twice", async () => {
    const request = await newRequest(120);
    const first = await payRequest(120, request.id);
    expect(first.status).toBe("COMPLETED");
    const balanceAfterFirst = await walletBalance(employeeWalletId);

    const second = await payRequest(120, request.id, { idempotencyKey: `retry-${request.id}` });
    expect(second.status).toBe("FAILED");
    if (second.status === "FAILED") expect(second.message).toContain("already been paid");
    expect(await walletBalance(employeeWalletId)).toBe(balanceAfterFirst);
  });

  it("lets the payer retry after an approval is rejected", async () => {
    const request = await newRequest(3_500);
    const res = await payRequest(3_500, request.id);
    expect(res.status).toBe("PENDING_APPROVAL");
    if (res.status !== "PENDING_APPROVAL") return;

    const parked = await prisma.paymentRequest.findUnique({ where: { id: request.id } });
    expect(parked!.status).toBe("AWAITING_APPROVAL");
    expect(parked!.txId).toBe(res.txId);

    await decideApproval(res.approvalId, financeId, "reject", "Not this quarter");

    const reopened = await prisma.paymentRequest.findUnique({ where: { id: request.id } });
    expect(reopened!.status).toBe("OPEN");
    expect(reopened!.txId).toBeNull();
    expect(reopened!.paidAt).toBeNull();

    // A fresh attempt (this time under the approval threshold is not possible — same amount
    // routes to the same approver), so approve it end to end instead.
    const retry = await payRequest(3_500, request.id, { idempotencyKey: `retry-${request.id}` });
    expect(retry.status).toBe("PENDING_APPROVAL");
    if (retry.status !== "PENDING_APPROVAL") return;
    const approved = await decideApproval(retry.approvalId, financeId, "approve");
    expect(approved.status).toBe("COMPLETED");

    const settled = await prisma.paymentRequest.findUnique({ where: { id: request.id } });
    expect(settled!.status).toBe("PAID");
    expect(settled!.txId).toBe(retry.txId);
  });

  it("moves no money while an approval is pending, and pays out exactly once on approval", async () => {
    const request = await newRequest(3_200);
    const employeeBefore = await walletBalance(employeeWalletId);
    const merchantBefore = await walletBalance(merchantWalletId);

    const res = await payRequest(3_200, request.id);
    expect(res.status).toBe("PENDING_APPROVAL");
    if (res.status !== "PENDING_APPROVAL") return;
    expect(await walletBalance(employeeWalletId)).toBe(employeeBefore);
    expect(await walletBalance(merchantWalletId)).toBe(merchantBefore);

    const approved = await decideApproval(res.approvalId, financeId, "approve");
    expect(approved.status).toBe("COMPLETED");
    expect(await walletBalance(employeeWalletId)).toBe(employeeBefore - birr(3_200));
    expect(await walletBalance(merchantWalletId)).toBe(merchantBefore + birr(3_200));

    const stored = await prisma.paymentRequest.findUnique({ where: { id: request.id } });
    expect(stored!.status).toBe("PAID");
    expect(stored!.paidAt).not.toBeNull();
  });

  it("blocks expired and cancelled requests", async () => {
    const expired = await newRequest(90, "Old coffee run", 15);
    await prisma.paymentRequest.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const employeeBefore = await walletBalance(employeeWalletId);

    const resolved = await resolveRequestPayload(expired.token);
    expect(resolved?.status).toBe("EXPIRED");
    expect(await expireStaleRequests(merchant.id)).toBe(0); // already swept by the resolve above

    const res = await payRequest(90, expired.id);
    expect(res.status).toBe("FAILED");
    if (res.status === "FAILED") expect(res.message).toContain("expired");
    expect(await walletBalance(employeeWalletId)).toBe(employeeBefore);

    const cancelled = await newRequest(150);
    const cancelledRow = await cancelPaymentRequest(cancelled.id, merchant.id);
    expect(cancelledRow.status).toBe("CANCELLED");
    await expect(cancelPaymentRequest(cancelled.id, merchant.id)).rejects.toThrow(/Only an open request/);

    const res2 = await payRequest(150, cancelled.id);
    expect(res2.status).toBe("FAILED");
    if (res2.status === "FAILED") expect(res2.message).toContain("cancelled");
  });

  it("sweeps stale open requests in bulk", async () => {
    const a = await newRequest(60, "Stale one");
    const b = await newRequest(70, "Stale two");
    await prisma.paymentRequest.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await expireStaleRequests(merchant.id)).toBe(2);

    const rows = await prisma.paymentRequest.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(rows.every((r) => r.status === "EXPIRED")).toBe(true);
  });

  it("refuses a request that belongs to another merchant", async () => {
    const request = await newRequest(200);
    const res = await payRequest(200, request.id, { merchantId: otherMerchantId, idempotencyKey: `other-${request.id}` });
    expect(res.status).toBe("FAILED");
    if (res.status === "FAILED") expect(res.message).toContain("different merchant");
  });

  it("lists a merchant's requests newest first", async () => {
    const fresh = await newRequest(333, "Newest charge");
    const list = await listMerchantRequests(merchant.id);
    expect(list[0].id).toBe(fresh.id);
    expect(list[0].purpose).toBe("Newest charge");
    expect(list.length).toBeGreaterThan(3);
  });
});

describe("checkRequestPayable (pure)", () => {
  const base = { status: "OPEN", expiresAt: null, amount: birr(500), merchantId: "m1" };

  it("accepts an open, matching request", () => {
    expect(checkRequestPayable(base, "m1", birr(500)).ok).toBe(true);
  });

  it("rejects a mismatched amount", () => {
    const r = checkRequestPayable(base, "m1", birr(499));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("exactly 500.00 ETB");
  });

  it("rejects paid, cancelled and expired requests", () => {
    for (const status of ["PAID", "CANCELLED", "EXPIRED", "AWAITING_APPROVAL"]) {
      expect(checkRequestPayable({ ...base, status }, "m1", birr(500)).ok).toBe(false);
    }
    expect(checkRequestPayable({ ...base, expiresAt: new Date(Date.now() - 1000) }, "m1", birr(500)).ok).toBe(false);
  });
});
