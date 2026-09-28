import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { postLedgerEntries } from "@/lib/ledger/ledger";
import { getRail, type PaymentRail, type RailResult } from "./rail";
import { PaymentError, Errors } from "./errors";
import { generateReference } from "@/lib/ids";
import { formatBirr } from "@/lib/money";
import { audit } from "@/lib/audit";
import { applyRequestTxState, checkRequestPayable } from "./requests";

type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ── Rule evaluation (all server-side) ────────────────────────

export interface RuleContext {
  walletBalance: bigint;
  amount: bigint;
  txLimit: bigint;
  dailyLimit: bigint;
  monthlyLimit: bigint;
  dailySpent: bigint;
  monthlySpent: bigint;
  blockedCategories: string[];
  category: string;
}

export type RuleResult = { ok: true } | { ok: false; error: PaymentError };

export function evaluateRules(ctx: RuleContext): RuleResult {
  if (ctx.amount <= 0n) return { ok: false, error: Errors.invalidAmount() };
  if (ctx.txLimit > 0n && ctx.amount > ctx.txLimit) {
    return { ok: false, error: Errors.txLimit(formatBirr(ctx.txLimit)) };
  }
  if (ctx.dailyLimit > 0n && ctx.dailySpent + ctx.amount > ctx.dailyLimit) {
    return { ok: false, error: Errors.dailyLimit(formatBirr(ctx.dailyLimit)) };
  }
  if (ctx.monthlyLimit > 0n && ctx.monthlySpent + ctx.amount > ctx.monthlyLimit) {
    return { ok: false, error: Errors.monthlyLimit(formatBirr(ctx.monthlyLimit)) };
  }
  if (ctx.walletBalance < ctx.amount) {
    return { ok: false, error: Errors.insufficientFunds() };
  }
  if (ctx.blockedCategories.includes(ctx.category)) {
    return { ok: false, error: Errors.categoryBlocked(ctx.category) };
  }
  return { ok: true };
}

export function getDailySpent(db: PrismaTx | PrismaClient, walletId: string): Promise<bigint> {
  return sumCompleted(db as PrismaTx, walletId, startOfDay());
}

export function getMonthlySpent(db: PrismaTx | PrismaClient, walletId: string): Promise<bigint> {
  return sumCompleted(db as PrismaTx, walletId, startOfMonth());
}

function sumCompleted(db: PrismaTx, walletId: string, since: Date): Promise<bigint> {
  return db.transaction
    .aggregate({
      where: {
        senderWalletId: walletId,
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    })
    .then((r) => r._sum.amount ?? 0n);
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d = new Date()): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ── Approval rules ───────────────────────────────────────────

export async function findApprovalRule(
  db: PrismaTx | PrismaClient,
  companyId: string,
  amount: bigint
): Promise<{ approverRole: "COMPANY_ADMIN" | "FINANCE_MANAGER"; ruleId: string } | null> {
  const rules = await db.approvalRule.findMany({ where: { companyId } });
  const match = rules.find(
    (r) => amount >= r.minAmount && (r.maxAmount === null || amount <= r.maxAmount)
  );
  if (!match) return null;
  return { approverRole: match.approverRole as "COMPANY_ADMIN" | "FINANCE_MANAGER", ruleId: match.id };
}

// ── Notifications ────────────────────────────────────────────

export type NotifyType =
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REQUIRES_APPROVAL"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_REVERSED"
  | "PAYMENT_RECEIVED"
  | "BUDGET_ALLOCATED"
  | "BUDGET_UPDATED"
  | "LIMIT_EXCEEDED"
  | "EMPLOYEE_LIMITS_UPDATED"
  | "EMPLOYEE_STATUS_CHANGED"
  | "COMPANY_UPDATED"
  | "BUDGET_REQUEST_SUBMITTED"
  | "BUDGET_REQUEST_DECIDED";

export async function notify(db: PrismaTx, input: { userId: string; type: NotifyType; title: string; body: string; txId?: string }): Promise<void> {
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      txId: input.txId,
    },
  });
}

// ── Payment engine ───────────────────────────────────────────

export interface InitiatePaymentInput {
  employeeUserId: string;
  amount: bigint;
  category: string;
  purpose: string;
  merchantId?: string;
  paymentId?: string;
  /** Merchant-initiated charge ("pay me exactly X ETB") that this payment settles. */
  requestId?: string;
  idempotencyKey?: string;
  ip?: string;
}

export type InitiatePaymentResult =
  | { status: "COMPLETED"; txId: string; reference: string; receiptUrl: string }
  | { status: "PENDING_APPROVAL"; txId: string; reference: string; approvalId: string }
  | { status: "FAILED"; code: string; message: string };

/**
 * The single entry point for employee payments. Runs all server-side checks,
 * handles idempotency, approval routing, ledger posting, notifications and
 * audit events inside one Prisma interactive transaction where needed.
 */
export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  // Idempotency: same key → return the original transaction
  if (input.idempotencyKey) {
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.status === "COMPLETED") {
        return {
          status: "COMPLETED",
          txId: existing.id,
          reference: existing.reference,
          receiptUrl: `/employee/receipts?tx=${existing.id}`,
        };
      }
      if (existing.status === "PENDING") {
        const appr = await prisma.approvalRequest.findUnique({ where: { txId: existing.id } });
        if (appr && appr.status === "PENDING") {
          return {
            status: "PENDING_APPROVAL",
            txId: existing.id,
            reference: existing.reference,
            approvalId: appr.id,
          };
        }
      }
      return { status: "FAILED", code: "DUPLICATE", message: "A payment with this idempotency key already exists" };
    }
  }

  const employee = await prisma.user.findUnique({
    where: { id: input.employeeUserId },
    include: {
      employeeProfile: { include: { wallet: true, company: true } },
    },
  });
  if (!employee || !employee.employeeProfile) {
    return { status: "FAILED", code: "NOT_EMPLOYEE", message: "Only employees can make payments" };
  }
  if (employee.status === "SUSPENDED") {
    return { status: "FAILED", code: "EMPLOYEE_INACTIVE", message: "Your account is suspended" };
  }
  const profile = employee.employeeProfile;
  if (!profile.wallet) {
    return { status: "FAILED", code: "WALLET_NOT_FOUND", message: "No wallet assigned" };
  }
  if (profile.company.status === "SUSPENDED") {
    return { status: "FAILED", code: "COMPANY_INACTIVE", message: "Your company is suspended" };
  }

  // Resolve the merchant by id or paymentId (e.g. CUPI-MER-XXXX)
  let merchant: { id: string; businessName: string; status: string; userId: string } | null = null;
  if (input.merchantId) {
    merchant = await prisma.merchant.findUnique({ where: { id: input.merchantId } });
  } else if (input.paymentId) {
    merchant = await prisma.merchant.findUnique({ where: { paymentId: input.paymentId } });
  }
  if (!merchant || merchant.status !== "ACTIVE") {
    return { status: "FAILED", code: "INVALID_MERCHANT", message: "Merchant not found or inactive" };
  }

  // Merchant-initiated request: the amount and merchant are locked by the request
  if (input.requestId) {
    const request = await prisma.paymentRequest.findUnique({ where: { id: input.requestId } });
    if (!request) {
      return { status: "FAILED", code: "REQUEST_NOT_FOUND", message: "Payment request not found" };
    }
    const payable = checkRequestPayable(request, merchant.id, input.amount);
    if (!payable.ok) {
      await audit({
        companyId: profile.companyId,
        actorId: employee.id,
        action: "PAYMENT_FAILED",
        entity: "PaymentRequest",
        entityId: request.id,
        ip: input.ip,
        metadata: { reason: "REQUEST_NOT_PAYABLE", request: request.code, amount: input.amount.toString() },
      });
      return { status: "FAILED", code: "REQUEST_NOT_PAYABLE", message: payable.message };
    }
  }
  const merchantWallet = await prisma.wallet.findUnique({ where: { merchantId: merchant.id } });
  if (!merchantWallet) {
    return { status: "FAILED", code: "WALLET_NOT_FOUND", message: "Merchant wallet missing" };
  }

  // Blocked categories from company spending-limit policy
  const policy = await prisma.spendingLimit.findFirst({
    where: { companyId: profile.companyId },
    orderBy: { isDefault: "desc" },
  });
  const blocked = policy ? policy.blockedCategories.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const dailySpent = await getDailySpent(prisma, profile.wallet.id);
  const monthlySpent = await getMonthlySpent(prisma, profile.wallet.id);

  const rule = evaluateRules({
    walletBalance: profile.wallet.balance,
    amount: input.amount,
    txLimit: profile.txLimit,
    dailyLimit: profile.dailyLimit,
    monthlyLimit: profile.monthlyLimit,
    dailySpent,
    monthlySpent,
    blockedCategories: blocked,
    category: input.category,
  });
  if (!rule.ok) {
    await audit({
      companyId: profile.companyId,
      actorId: employee.id,
      action: "PAYMENT_FAILED",
      entity: "Transaction",
      ip: input.ip,
      metadata: { reason: rule.error.code, amount: input.amount.toString(), merchant: merchant.businessName },
    });
    return { status: "FAILED", code: rule.error.code, message: rule.error.message };
  }

  const reference = generateReference();

  // Approval routing
  const approvalMatch = await findApprovalRule(prisma, profile.companyId, input.amount);
  if (approvalMatch) {
    const { tx, approvalId } = await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          reference,
          senderWalletId: profile.wallet!.id,
          recipientWalletId: merchantWallet.id,
          senderLabel: employee.fullName,
          recipientLabel: merchant!.businessName,
          amount: input.amount,
          type: "PAYMENT",
          status: "PENDING",
          purpose: input.purpose,
          category: input.category,
          idempotencyKey: input.idempotencyKey,
          merchantId: merchant!.id,
          companyId: profile.companyId,
          meta: { approvalRequired: true, approverRole: approvalMatch.approverRole },
        },
      });
      await tx.payment.create({
        data: { txId: t.id, rail: "internal", status: "PENDING" },
      });
      const appr = await tx.approvalRequest.create({
        data: { txId: t.id, employeeId: profile.id, status: "PENDING" },
      });
      await notify(tx, {
        userId: employee.id,
        type: "PAYMENT_REQUIRES_APPROVAL",
        title: "Payment awaiting approval",
        body: `${formatBirr(input.amount)} ETB to ${merchant!.businessName} requires approval.`,
        txId: t.id,
      });
      await audit({
        companyId: profile.companyId,
        actorId: employee.id,
        action: "PAYMENT_INITIATED",
        entity: "Transaction",
        entityId: t.id,
        ip: input.ip,
        metadata: { reference, amount: input.amount.toString(), approval: true },
      });
      if (input.requestId) await applyRequestTxState(tx, t.id, "AWAITING_APPROVAL", input.requestId);
      return { tx: t, approvalId: appr.id };
    });
    return { status: "PENDING_APPROVAL", txId: tx.id, reference, approvalId };
  }

  // No approval required → execute immediately
  const rail: PaymentRail = getRail("internal");
  const t = await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        reference,
        senderWalletId: profile.wallet!.id,
        recipientWalletId: merchantWallet.id,
        senderLabel: employee.fullName,
        recipientLabel: merchant!.businessName,
        amount: input.amount,
        type: "PAYMENT",
        status: "PROCESSING",
        purpose: input.purpose,
        category: input.category,
        idempotencyKey: input.idempotencyKey,
        merchantId: merchant!.id,
        companyId: profile.companyId,
      },
    });
    await tx.payment.create({
      data: { txId: t.id, rail: rail.code, status: "PROCESSING" },
    });
    const railResult = await rail.createPayment({
      txId: t.id,
      reference,
      amount: input.amount,
      currency: "ETB",
      senderWalletId: profile.wallet!.id,
      recipientWalletId: merchantWallet.id,
      purpose: input.purpose,
    });
    if (!railResult.ok) {
      throw new Error(`Rail rejected payment: ${railResult.failureReason}`);
    }
    await postLedgerEntries(tx, t.id, [
      { walletId: profile.wallet!.id, amount: -input.amount, description: `Payment to ${merchant!.businessName}` },
      { walletId: merchantWallet.id, amount: input.amount, description: `Payment from ${employee.fullName}` },
    ]);
    await tx.payment.update({
      where: { txId: t.id },
      data: { status: "COMPLETED", railRef: railResult.railRef, completedAt: new Date() },
    });
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await notify(tx, {
      userId: employee.id,
      type: "PAYMENT_COMPLETED",
      title: "Payment successful",
      body: `${formatBirr(input.amount)} ETB paid to ${merchant!.businessName}. Ref ${reference}`,
      txId: t.id,
    });
    await notify(tx, {
      userId: merchant!.userId,
      type: "PAYMENT_RECEIVED",
      title: "Payment received",
      body: `${formatBirr(input.amount)} ETB received from ${employee.fullName}. Ref ${reference}`,
      txId: t.id,
    });
    await audit({
      companyId: profile.companyId,
      actorId: employee.id,
      action: "PAYMENT_COMPLETED",
      entity: "Transaction",
      entityId: t.id,
      ip: input.ip,
      metadata: { reference, amount: input.amount.toString(), merchant: merchant!.businessName },
    });
    if (input.requestId) await applyRequestTxState(tx, t.id, "PAID", input.requestId);
    return t;
  });

  return {
    status: "COMPLETED",
    txId: t.id,
    reference,
    receiptUrl: `/employee/receipts?tx=${t.id}`,
  };
}

// ── Reversal ─────────────────────────────────────────────────

export async function reversePayment(
  txId: string,
  actorId: string,
  reason: string,
  ip?: string
): Promise<{ reference: string }> {
  const original = await prisma.transaction.findUnique({
    where: { id: txId },
    include: {
      payments: true,
      senderWallet: { include: { employeeProfile: true } },
      recipientWallet: { include: { merchant: true } },
    },
  });
  if (!original) throw new PaymentError("NOT_FOUND", "Transaction not found", 404);
  if (original.status !== "COMPLETED") {
    throw new PaymentError("NOT_REVERSIBLE", "Only completed payments can be reversed", 400);
  }
  if (original.type === "REVERSAL") {
    throw new PaymentError("NOT_REVERSIBLE", "A reversal cannot be reversed", 400);
  }
  const alreadyReversed = await prisma.transaction.findFirst({
    where: { reversalOfId: txId, status: "COMPLETED" },
  });
  if (alreadyReversed) {
    throw new PaymentError("ALREADY_REVERSED", "This payment has already been reversed", 400);
  }

  const reference = generateReference();
  const rail = getRail(original.payments[0]?.rail ?? "internal");

  await prisma.$transaction(async (tx) => {
    const reversal = await tx.transaction.create({
      data: {
        reference,
        senderWalletId: original.recipientWalletId,
        recipientWalletId: original.senderWalletId,
        senderLabel: original.recipientLabel,
        recipientLabel: original.senderLabel,
        amount: original.amount,
        type: "REVERSAL",
        status: "PROCESSING",
        purpose: `Reversal of ${original.reference}`,
        category: original.category,
        companyId: original.companyId,
        reversalOfId: original.id,
        meta: { reason },
      },
    });
    await tx.payment.create({
      data: { txId: reversal.id, rail: rail.code, status: "PROCESSING" },
    });
    const railResult = await rail.reversePayment(
      original.payments[0]?.railRef ?? "",
      reversal.id,
      original.amount
    );
    if (!railResult.ok) {
      throw new Error(`Rail rejected reversal: ${railResult.failureReason}`);
    }
    if (original.senderWalletId && original.recipientWalletId) {
      await postLedgerEntries(tx, reversal.id, [
        { walletId: original.recipientWalletId, amount: -original.amount, description: `Reversal of ${original.reference}` },
        { walletId: original.senderWalletId, amount: original.amount, description: `Refund for ${original.reference}` },
      ]);
    }
    await tx.payment.update({
      where: { txId: reversal.id },
      data: { status: "COMPLETED", railRef: railResult.railRef, completedAt: new Date() },
    });
    await tx.transaction.update({
      where: { id: reversal.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.transaction.update({
      where: { id: original.id },
      data: { status: "REVERSED" },
    });
    if (original.senderWallet?.employeeProfile) {
      await notify(tx, {
        userId: original.senderWallet.employeeProfile.userId,
        type: "PAYMENT_REVERSED",
        title: "Payment reversed",
        body: `${formatBirr(original.amount)} ETB refunded to your wallet. Ref ${reference}`,
        txId: reversal.id,
      });
    }
    if (original.recipientWallet?.merchant) {
      await notify(tx, {
        userId: original.recipientWallet.merchant.userId,
        type: "PAYMENT_REVERSED",
        title: "Payment reversed",
        body: `${formatBirr(original.amount)} ETB deducted from your wallet. Ref ${reference}`,
        txId: reversal.id,
      });
    }
  });

  await audit({
    companyId: original.companyId,
    actorId,
    action: "PAYMENT_REVERSED",
    entity: "Transaction",
    entityId: original.id,
    ip,
    metadata: { reversalRef: reference, reason },
  });

  return { reference };
}

// ── Approval decisions ───────────────────────────────────────

export async function decideApproval(
  approvalId: string,
  approverId: string,
  action: "approve" | "reject",
  reason?: string,
  ip?: string
): Promise<{ reference: string; status: "COMPLETED" | "REJECTED" }> {
  const appr = await prisma.approvalRequest.findUnique({
    where: { id: approvalId },
    include: {
      tx: {
        include: {
          payments: true,
          senderWallet: { include: { employeeProfile: true } },
          recipientWallet: { include: { merchant: true } },
        },
      },
      employee: { include: { user: true } },
    },
  });
  if (!appr) throw new PaymentError("NOT_FOUND", "Approval request not found", 404);
  if (appr.status !== "PENDING") {
    throw new PaymentError("ALREADY_DECIDED", "This approval has already been decided", 400);
  }

  const t = appr.tx;
  const rail = getRail(t.payments[0]?.rail ?? "internal");

  if (action === "reject") {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: approvalId },
        data: { status: "REJECTED", approverId, decidedAt: new Date(), reason },
      });
      await tx.transaction.update({
        where: { id: t.id },
        data: { status: "CANCELLED" },
      });
      await tx.payment.update({
        where: { txId: t.id },
        data: { status: "FAILED", failureReason: "Rejected by approver" },
      });
      await notify(tx, {
        userId: appr.employee.userId,
        type: "PAYMENT_REJECTED",
        title: "Payment rejected",
        body: `Your payment of ${formatBirr(t.amount)} ETB was rejected.${reason ? ` Reason: ${reason}` : ""}`,
        txId: t.id,
      });
      // Reopen the merchant request so the payer can retry it
      await applyRequestTxState(tx, t.id, "OPEN");
    });
    await audit({
      companyId: t.companyId,
      actorId: approverId,
      action: "PAYMENT_REJECTED",
      entity: "Transaction",
      entityId: t.id,
      ip,
      metadata: { reference: t.reference, reason },
    });
    return { reference: t.reference, status: "REJECTED" };
  }

  // Approve → execute the payment now
  const senderWallet = t.senderWallet;
  const recipientWallet = t.recipientWallet;
  if (!senderWallet || !recipientWallet) {
    throw new PaymentError("WALLET_NOT_FOUND", "Wallet missing", 500);
  }

  const railResult = await rail.createPayment({
    txId: t.id,
    reference: t.reference,
    amount: t.amount,
    currency: t.currency,
    senderWalletId: senderWallet.id,
    recipientWalletId: recipientWallet.id,
    purpose: t.purpose,
  });
  if (!railResult.ok) {
    throw new PaymentError("RAIL_ERROR", railResult.failureReason ?? "Rail error", 500);
  }

  await prisma.$transaction(async (tx) => {
    await postLedgerEntries(tx, t.id, [
      { walletId: senderWallet.id, amount: -t.amount, description: `Payment to ${t.recipientLabel ?? "merchant"}` },
      { walletId: recipientWallet.id, amount: t.amount, description: `Payment from ${t.senderLabel ?? "employee"}` },
    ]);
    await tx.payment.update({
      where: { txId: t.id },
      data: { status: "COMPLETED", railRef: railResult.railRef, completedAt: new Date() },
    });
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.approvalRequest.update({
      where: { id: approvalId },
      data: { status: "APPROVED", approverId, decidedAt: new Date(), reason },
    });
    await notify(tx, {
      userId: appr.employee.userId,
      type: "PAYMENT_COMPLETED",
      title: "Payment approved & completed",
      body: `${formatBirr(t.amount)} ETB paid to ${t.recipientLabel}. Ref ${t.reference}`,
      txId: t.id,
    });
    if (recipientWallet.merchant) {
      await notify(tx, {
        userId: recipientWallet.merchant.userId,
        type: "PAYMENT_RECEIVED",
        title: "Payment received",
        body: `${formatBirr(t.amount)} ETB received from ${t.senderLabel}. Ref ${t.reference}`,
        txId: t.id,
      });
    }
    await applyRequestTxState(tx, t.id, "PAID");
  });

  await audit({
    companyId: t.companyId,
    actorId: approverId,
    action: "PAYMENT_APPROVED",
    entity: "Transaction",
    entityId: t.id,
    ip,
    metadata: { reference: t.reference },
  });

  return { reference: t.reference, status: "COMPLETED" };
}

export type { RailResult };
