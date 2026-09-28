import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth } from "@/lib/payments/engine";
import { StatCard, Money, StatusBadge, EmptyState } from "@/components/ui";

async function getOverview(companyId: string) {
  const companyWallet = await prisma.wallet.findFirst({ where: { ownerType: "COMPANY", companyId } });
  const monthStart = startOfMonth();
  const dayStart = startOfDay();

  const [wallet, monthAgg, dayAgg, pendingAgg, employeeCount, recent, topEmployees] = await Promise.all([
    companyWallet
      ? prisma.wallet.findUnique({ where: { id: companyWallet.id } })
      : Promise.resolve(null),
    prisma.transaction.aggregate({
      where: { companyId, type: "PAYMENT", status: "COMPLETED", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "PAYMENT", status: "COMPLETED", createdAt: { gte: dayStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "PAYMENT", status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.employeeProfile.count({ where: { companyId } }),
    prisma.transaction.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.$queryRaw<{ name: string; total: bigint }[]>`
      SELECT u."fullName" AS name, SUM(t.amount) AS total
      FROM "Transaction" t
      JOIN "Wallet" w ON w.id = t."senderWalletId"
      JOIN "EmployeeProfile" ep ON ep.id = w."employeeId"
      JOIN "User" u ON u.id = ep."userId"
      WHERE t."companyId" = ${companyId} AND t.status = 'COMPLETED' AND t.type = 'PAYMENT' AND t."createdAt" >= ${monthStart}
      GROUP BY u."fullName" ORDER BY total DESC LIMIT 5`,
  ]);

  return { wallet, monthAgg, dayAgg, pendingAgg, employeeCount, recent, topEmployees };
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user?.companyId) redirect("/login");
  const { wallet, monthAgg, dayAgg, pendingAgg, employeeCount, recent, topEmployees } = await getOverview(user.companyId);
  const balance = wallet?.balance ?? 0n;
  // $queryRaw may return SUM as string — coerce to BigInt for arithmetic
  const topEmployeesSafe = topEmployees.map((e) => ({ name: e.name, total: BigInt(e.total as unknown as string | bigint) }));
  const maxEmp = topEmployeesSafe.reduce((m, e) => (e.total > m ? e.total : m), 0n);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Corporate balance</h1>
        <div className="text-[36px] md:text-[44px] font-black tabular tracking-tight leading-tight" style={{ color: "var(--brand-ink)" }}>
          {balance.toLocaleString("en-US")}.00 <span className="text-[20px] font-bold text-[var(--ink-3)]">ETB</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Spent this month" value={<Money minor={monthAgg._sum.amount ?? 0n} />} sub="All completed payments" />
        <StatCard label="Today" value={<Money minor={dayAgg._sum.amount ?? 0n} />} sub="Employee payments" />
        <StatCard label="Pending approval" value={<Money minor={pendingAgg._sum.amount ?? 0n} />} tone="warn" sub="Awaiting decision" />
        <StatCard label="Employees" value={employeeCount} sub="Active payment users" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top employees this month */}
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[15px]">Spending by employee · this month</h2>
            <Link href="/dashboard/reports" className="text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>
              Reports →
            </Link>
          </div>
          {topEmployeesSafe.length === 0 ? (
            <EmptyState title="No spending yet" body="Employee payments will appear here." />
          ) : (
            <div className="space-y-3">
              {topEmployeesSafe.map((e) => (
                <div key={e.name}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="font-medium">{e.name}</span>
                    <span className="tabular font-semibold">{Number(e.total) / 100} ETB</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.max(4, Number((e.total * 100n) / (maxEmp || 1n)))}%`, background: "var(--brand)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card">
          <div className="px-4 pt-4 flex items-center justify-between">
            <h2 className="font-bold text-[15px]">Recent transactions</h2>
            <Link href="/dashboard/transactions" className="text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>
              View all →
            </Link>
          </div>
          <div className="p-2">
            {recent.length === 0 ? (
              <EmptyState title="No transactions yet" />
            ) : (
              recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-2 py-2.5 rounded-md hover:bg-[var(--surface-2)]">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">
                      {t.senderLabel} → {t.recipientLabel}
                    </div>
                    <div className="text-[11.5px] text-[var(--ink-3)] tabular">{t.reference}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[13.5px] font-semibold tabular">
                      {t.type === "PAYMENT" ? "-" : t.type === "REVERSAL" ? "+" : ""}
                      {Number(t.amount) / 100} ETB
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
