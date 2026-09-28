import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth } from "@/lib/payments/engine";

export async function GET() {
  try {
    const user = await requireUser();

    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        include: { wallet: true },
      });
      if (!profile || !profile.wallet) return NextResponse.json({ error: "No wallet" }, { status: 404 });
      const walletId = profile.wallet.id;
      const [dailyAgg, monthlyAgg] = await Promise.all([
        prisma.transaction.aggregate({
          where: { senderWalletId: walletId, status: "COMPLETED", createdAt: { gte: startOfDay() } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { senderWalletId: walletId, status: "COMPLETED", createdAt: { gte: startOfMonth() } },
          _sum: { amount: true },
        }),
      ]);
      return NextResponse.json({
        role: "employee",
        balance: profile.wallet.balance,
        monthlyLimit: profile.monthlyLimit,
        dailyLimit: profile.dailyLimit,
        txLimit: profile.txLimit,
        dailySpent: dailyAgg._sum.amount ?? 0n,
        monthlySpent: monthlyAgg._sum.amount ?? 0n,
      });
    }

    if (user.role === "MERCHANT") {
      const merchant = await prisma.merchant.findUnique({ where: { userId: user.id }, include: { wallet: true } });
      if (!merchant?.wallet) return NextResponse.json({ error: "No wallet" }, { status: 404 });
      const todayAgg = await prisma.transaction.aggregate({
        where: { recipientWalletId: merchant.wallet.id, status: "COMPLETED", type: "PAYMENT", createdAt: { gte: startOfDay() } },
        _sum: { amount: true },
        _count: true,
      });
      return NextResponse.json({
        role: "merchant",
        balance: merchant.wallet.balance,
        todaySales: todayAgg._sum.amount ?? 0n,
        todayCount: todayAgg._count ?? 0,
        paymentId: merchant.paymentId,
      });
    }

    if (user.companyId) {
      const wallet = await prisma.wallet.findFirst({ where: { ownerType: "COMPANY", companyId: user.companyId } });
      if (!wallet) return NextResponse.json({ error: "No wallet" }, { status: 404 });
      const monthAgg = await prisma.transaction.aggregate({
        where: { companyId: user.companyId, senderWalletId: wallet.id, status: "COMPLETED", createdAt: { gte: startOfMonth() } },
        _sum: { amount: true },
      });
      return NextResponse.json({ role: "company", balance: wallet.balance, monthSpent: monthAgg._sum.amount ?? 0n });
    }

    return NextResponse.json({ error: "No wallet" }, { status: 404 });
  } catch (err) {
    return handleApiError(err);
  }
}
