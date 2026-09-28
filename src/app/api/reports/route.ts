import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "@/lib/payments/engine";

export async function GET() {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const companyId = user.companyId;

    const companyWallet = await prisma.wallet.findFirst({ where: { ownerType: "COMPANY", companyId } });
    const monthStart = startOfMonth();
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const [totalAgg, monthAgg, pendingCount, pendingSum, employees, byCategory, dailyRows, monthlyRows] = await Promise.all([
      prisma.transaction.aggregate({
        where: { companyId, senderWalletId: companyWallet?.id, status: "COMPLETED", type: "ALLOCATION" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId, status: "COMPLETED", type: "PAYMENT", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({ where: { companyId, status: "PENDING" } }),
      prisma.transaction.aggregate({
        where: { companyId, status: "PENDING", type: "PAYMENT" },
        _sum: { amount: true },
      }),
      prisma.employeeProfile.count({ where: { companyId } }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { companyId, status: "COMPLETED", type: "PAYMENT" },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<{ day: Date; total: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, SUM(amount) AS total
        FROM "Transaction"
        WHERE "companyId" = ${companyId} AND status = 'COMPLETED' AND type = 'PAYMENT' AND "createdAt" >= ${monthStart}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: Date; total: bigint }[]>`
        SELECT date_trunc('month', "createdAt") AS month, SUM(amount) AS total
        FROM "Transaction"
        WHERE "companyId" = ${companyId} AND status = 'COMPLETED' AND type = 'PAYMENT' AND "createdAt" >= ${yearStart}
        GROUP BY 1 ORDER BY 1`,
    ]);

    // Spending by employee (via sender wallets)
    const empSpend = await prisma.$queryRaw<{ name: string; total: bigint }[]>`
      SELECT u."fullName" AS name, SUM(t.amount) AS total
      FROM "Transaction" t
      JOIN "Wallet" w ON w.id = t."senderWalletId"
      JOIN "EmployeeProfile" ep ON ep.id = w."employeeId"
      JOIN "User" u ON u.id = ep."userId"
      WHERE t."companyId" = ${companyId} AND t.status = 'COMPLETED' AND t.type = 'PAYMENT'
      GROUP BY u."fullName" ORDER BY total DESC LIMIT 10`;

    const companyBalance = companyWallet?.balance ?? 0n;

    return NextResponse.json({
      companyBalance,
      monthSpent: monthAgg._sum.amount ?? 0n,
      pendingCount,
      pendingAmount: pendingSum._sum.amount ?? 0n,
      employees,
      allocations: totalAgg._sum.amount ?? 0n,
      byCategory: byCategory.map((c) => ({ category: c.category ?? "Uncategorized", total: c._sum.amount ?? 0n })),
      daily: dailyRows.map((r) => ({ day: r.day, total: r.total })),
      monthly: monthlyRows.map((r) => ({ month: r.month, total: r.total })),
      byEmployee: empSpend.map((r) => ({ name: r.name, total: r.total })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
