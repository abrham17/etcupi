"use client";

import { useEffect, useState } from "react";
import { formatBirr } from "@/lib/money";
import { StatusBadge, EmptyState } from "@/components/ui";

interface Tx {
  id: string;
  reference: string;
  createdAt: string;
  senderLabel: string | null;
  recipientLabel: string | null;
  amount: string;
  status: string;
  purpose: string | null;
  type: string;
}

export default function EmployeeTransactions() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments?pageSize=50")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.transactions ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="pb-safe min-h-screen">
      <div className="sticky top-0 z-10 h-14 flex items-center px-5 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="font-bold text-[16px]">Activity</div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="text-[13px] text-[var(--ink-3)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="card"><EmptyState title="No activity yet" body="Your payments and allocations will appear here." /></div>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => {
              const outgoing = t.type === "PAYMENT";
              return (
                <div key={t.id} className="card px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">
                      {outgoing ? t.recipientLabel : t.senderLabel}
                    </div>
                    <div className="text-[12px] text-[var(--ink-3)] truncate">
                      {t.purpose ?? t.reference} · {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`text-[14.5px] font-bold tabular ${t.type === "ALLOCATION" || t.type === "REVERSAL" ? "text-[var(--ok)]" : ""}`}>
                      {t.type === "PAYMENT" ? "-" : "+"}
                      {formatBirr(BigInt(t.amount))}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
