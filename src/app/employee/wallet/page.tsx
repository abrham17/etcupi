"use client";

import { useEffect, useState } from "react";
import { formatBirr } from "@/lib/money";

interface WalletData {
  balance: string;
  monthlyLimit: string;
  dailyLimit: string;
  txLimit: string;
  dailySpent: string;
  monthlySpent: string;
}

function Bar({ used, limit, label }: { used: bigint; limit: bigint; label: string }) {
  const pct = limit > 0n ? Math.min(100, Number((used * 100n) / limit)) : 0;
  const over = limit > 0n && used > limit;
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1.5">
        <span className="text-[var(--ink-2)] font-medium">{label}</span>
        <span className="tabular font-semibold">
          {formatBirr(used)} <span className="text-[var(--ink-3)] font-normal">/ {formatBirr(limit)}</span>
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? "var(--danger)" : pct > 80 ? "var(--warn)" : "var(--brand)" }}
        />
      </div>
    </div>
  );
}

export default function EmployeeWallet() {
  const [w, setW] = useState<WalletData | null>(null);

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then(setW);
  }, []);

  if (!w) return <main className="pb-safe min-h-screen flex items-center justify-center text-[13px] text-[var(--ink-3)]">Loading…</main>;

  return (
    <main className="pb-safe min-h-screen">
      <div className="px-5 pt-6 pb-6 text-white" style={{ background: "var(--brand)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
        <div className="text-[12.5px] uppercase tracking-wide opacity-75 font-semibold">Available balance</div>
        <div className="text-[40px] font-black tabular leading-none mt-1">
          {formatBirr(BigInt(w.balance))} <span className="text-[18px] font-bold opacity-80">ETB</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="card card-pad space-y-4">
          <div className="font-bold text-[15px]">Spending limits</div>
          <Bar label="This month" used={BigInt(w.monthlySpent)} limit={BigInt(w.monthlyLimit)} />
          <Bar label="Today" used={BigInt(w.dailySpent)} limit={BigInt(w.dailyLimit)} />
          <div className="flex justify-between text-[13px] pt-1 border-t">
            <span className="text-[var(--ink-2)] font-medium">Single payment cap</span>
            <span className="tabular font-semibold">{formatBirr(BigInt(w.txLimit))} ETB</span>
          </div>
        </div>
        <p className="text-[12px] text-[var(--ink-3)] px-1">
          Limits are set by your company administrator. Payments above the auto-approve threshold need a manager approval before
          the money moves.
        </p>
      </div>
    </main>
  );
}
