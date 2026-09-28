import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth } from "@/lib/payments/engine";
import { formatBirr } from "@/lib/money";
import { StatusBadge } from "@/components/ui";

export default async function MerchantHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    include: { wallet: true },
  });
  if (!merchant?.wallet) redirect("/login");

  const walletId = merchant.wallet.id;
  const [todayAgg, monthAgg, pendingCount, recent] = await Promise.all([
    prisma.transaction.aggregate({
      where: { recipientWalletId: walletId, status: "COMPLETED", type: "PAYMENT", createdAt: { gte: startOfDay() } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { recipientWalletId: walletId, status: "COMPLETED", type: "PAYMENT", createdAt: { gte: startOfMonth() } },
      _sum: { amount: true },
    }),
    prisma.transaction.count({ where: { recipientWalletId: walletId, status: "PENDING" } }),
    prisma.transaction.findMany({
      where: { recipientWalletId: walletId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <main className="pb-safe">
      <div className="px-5 pt-6 pb-5 text-white" style={{ background: "var(--brand)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
        <div className="text-[13px] opacity-85">{merchant.businessName}</div>
        <div className="mt-2 text-[12.5px] uppercase tracking-wide opacity-75 font-semibold">Today's sales</div>
        <div className="text-[38px] font-black tabular leading-none mt-0.5">
          {formatBirr(todayAgg._sum.amount ?? 0n)} <span className="text-[17px] font-bold opacity-80">ETB</span>
        </div>
        <div className="mt-3 flex gap-4 text-[12.5px]">
          <div>
            <span className="opacity-75">This month: </span>
            <span className="font-bold tabular">{formatBirr(monthAgg._sum.amount ?? 0n)} ETB</span>
          </div>
          <div>
            <span className="opacity-75">Balance: </span>
            <span className="font-bold tabular">{formatBirr(merchant.wallet.balance)} ETB</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Link
          href="/merchant/receive"
          className="flex items-center justify-center gap-2.5 h-16 rounded-xl text-white text-[16px] font-bold shadow-sm"
          style={{ background: "var(--brand)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v11M8 10l4 4 4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          Receive payment
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/merchant/qr"
            className="btn-secondary h-12 rounded-xl text-[14px] font-bold"
          >
            My QR code
          </Link>
          <Link
            href="/merchant/transactions"
            className="btn-secondary h-12 rounded-xl text-[14px] font-bold"
          >
            Transactions
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="card p-3.5 text-center">
            <div className="text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Payments today</div>
            <div className="text-[20px] font-bold tabular mt-0.5">{todayAgg._count ?? 0}</div>
          </div>
          <div className="card p-3.5 text-center">
            <div className="text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Pending</div>
            <div className="text-[20px] font-bold tabular mt-0.5">{pendingCount}</div>
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-bold mb-2 px-1">Recent payments</h2>
          <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
            {recent.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[var(--ink-3)]">
                No payments yet — share your QR code to start receiving.
              </div>
            ) : (
              recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">{t.senderLabel}</div>
                    <div className="text-[12px] text-[var(--ink-3)] truncate">
                      {t.purpose ?? t.reference} · {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[14px] font-bold tabular text-[var(--ok)]">+{formatBirr(t.amount)}</div>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
