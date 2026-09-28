import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth } from "@/lib/payments/engine";
import { StatusBadge } from "@/components/ui";
import { formatBirr } from "@/lib/money";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function EmployeeHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
    include: { wallet: true, department: true },
  });
  if (!profile?.wallet) redirect("/login");

  const walletId = profile.wallet.id;
  const [dailyAgg, monthlyAgg, recent] = await Promise.all([
    prisma.transaction.aggregate({
      where: { senderWalletId: walletId, status: "COMPLETED", createdAt: { gte: startOfDay() } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { senderWalletId: walletId, status: "COMPLETED", createdAt: { gte: startOfMonth() } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { OR: [{ senderWalletId: walletId }, { recipientWalletId: walletId }] },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const balance = profile.wallet.balance;
  const monthlySpent = monthlyAgg._sum.amount ?? 0n;
  const monthlyPct = profile.monthlyLimit > 0n ? Math.min(100, Number((monthlySpent * 100n) / profile.monthlyLimit)) : 0;
  const firstName = user.name.split(" ")[0];

  return (
    <main className="pb-safe">
      {/* Header */}
      <div className="px-5 pt-6 pb-5 text-white" style={{ background: "var(--brand)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
        <div className="text-[14px] opacity-90">{greeting()}, {firstName}</div>
        <div className="mt-3 text-[12.5px] uppercase tracking-wide opacity-75 font-semibold">Available</div>
        <div className="text-[40px] font-black tabular leading-none mt-0.5">
          {formatBirr(balance)} <span className="text-[18px] font-bold opacity-80">ETB</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12.5px]">
          <span className="opacity-85">Monthly spent:</span>
          <span className="font-bold tabular">{formatBirr(monthlySpent)} ETB</span>
          <span className="opacity-75">/ {formatBirr(profile.monthlyLimit)}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/25">
          <div className="h-1.5 rounded-full bg-white" style={{ width: `${monthlyPct}%` }} />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Scan & Pay */}
        <Link
          href="/employee/pay"
          className="flex items-center justify-center gap-2.5 h-14 rounded-xl text-white text-[16px] font-bold tracking-wide active:scale-[0.99] transition-transform"
          style={{ background: "var(--brand-strong)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
            <path d="M7 12h10" />
          </svg>
          SCAN & PAY
        </Link>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card p-3 text-center">
            <div className="text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Today</div>
            <div className="text-[14px] font-bold tabular mt-0.5">{formatBirr(dailyAgg._sum.amount ?? 0n)}</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Daily limit</div>
            <div className="text-[14px] font-bold tabular mt-0.5">{formatBirr(profile.dailyLimit)}</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Per payment</div>
            <div className="text-[14px] font-bold tabular mt-0.5">{formatBirr(profile.txLimit)}</div>
          </div>
        </div>

        {/* Pending approvals notice */}
        <PendingNotice />

        {/* Recent payments */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[15px] font-bold">Recent payments</h2>
            <Link href="/employee/transactions" className="text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>
              See all
            </Link>
          </div>
          <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
            {recent.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[var(--ink-3)]">No payments yet — start with Scan &amp; Pay</div>
            ) : (
              recent.map((t) => {
                const outgoing = t.senderWalletId === walletId;
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">{outgoing ? t.recipientLabel : t.senderLabel}</div>
                      <div className="text-[12px] text-[var(--ink-3)] truncate">
                        {t.purpose ?? t.reference} · {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className={`text-[14px] font-bold tabular ${outgoing ? "" : "text-[var(--ok)]"}`}>
                        {outgoing ? "-" : "+"}
                        {formatBirr(t.amount)}
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

async function PendingNotice() {
  return null;
}
