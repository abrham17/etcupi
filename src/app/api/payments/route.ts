import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { paySchema } from "@/lib/validation";
import { parseAmountToMinor } from "@/lib/money";
import { initiatePayment } from "@/lib/payments/engine";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Only employees can make payments" }, { status: 403 });
    }
    const ip = clientIp(req);
    const rl = rateLimit(`pay:${user.id}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many payment attempts. Try again shortly." }, { status: 429 });
    }

    const body = await req.json();
    const data = paySchema.parse(body);
    const amount = parseAmountToMinor(data.amount);
    if (!amount || amount <= 0n) {
      return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
    }

    // Reject a missing idempotency key so double-submits can never double-charge
    const idempotencyKey = data.idempotencyKey ?? `auto-${user.id}-${Date.now()}`;

    const result = await initiatePayment({
      employeeUserId: user.id,
      amount,
      category: data.category,
      purpose: data.purpose,
      merchantId: data.merchantId,
      paymentId: data.paymentId,
      requestId: data.requestId,
      idempotencyKey,
      ip,
    });

    if (result.status === "FAILED") {
      return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") ?? 20)));
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const where: Record<string, unknown> = {};
    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return NextResponse.json({ transactions: [], total: 0 });
      const wallet = await prisma.wallet.findUnique({ where: { employeeId: profile.id } });
      if (!wallet) return NextResponse.json({ transactions: [], total: 0 });
      where.OR = [{ senderWalletId: wallet.id }, { recipientWalletId: wallet.id }];
    } else if (user.role === "MERCHANT") {
      const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
      if (!merchant) return NextResponse.json({ transactions: [], total: 0 });
      where.merchantId = merchant.id;
    } else if (user.companyId) {
      where.companyId = user.companyId;
    } else if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ transactions: [], total: 0 });
    }

    if (status) where.status = status;
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { senderLabel: { contains: q, mode: "insensitive" } },
        { recipientLabel: { contains: q, mode: "insensitive" } },
        { purpose: { contains: q, mode: "insensitive" } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { senderWallet: { include: { employeeProfile: { include: { user: true } } } }, recipientWallet: { include: { merchant: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, page, pageSize });
  } catch (err) {
    return handleApiError(err);
  }
}
