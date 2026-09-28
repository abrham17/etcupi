"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBirr } from "@/lib/money";
import { StatusBadge, EmptyState } from "./ui";

export interface TxRow {
  id: string;
  reference: string;
  createdAt: string;
  senderLabel: string | null;
  recipientLabel: string | null;
  amount: string; // bigint serialized as string via JSON
  status: string;
  category: string | null;
  purpose: string | null;
  type: string;
}

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Payment",
  ALLOCATION: "Allocation",
  TOPUP: "Top-up",
  REVERSAL: "Reversal",
};

export function TxTable({ apiPath, canReverse = false }: { apiPath: string; canReverse?: boolean }) {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [reversing, setReversing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`${apiPath}?${params.toString()}`);
    const data = await res.json();
    setRows(data.transactions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, apiPath]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))) as string[], [rows]);
  const filtered = category ? rows.filter((r) => r.category === category) : rows;

  async function reverse(id: string) {
    const reason = window.prompt("Reversal reason (required):");
    if (!reason || reason.trim().length < 3) return;
    setReversing(id);
    const res = await fetch(`/api/payments/${id}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const data = await res.json();
    setReversing(null);
    if (res.ok) {
      setMessage(`Reversed. New reference ${data.reference}`);
      load();
    } else {
      setMessage(data.error ?? "Reversal failed");
    }
  }

  return (
    <div className="card">
      <div className="p-3 border-b flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference, name, purpose…"
          className="input h-9 flex-1 min-w-[180px] text-[13px]"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input h-9 w-auto text-[13px] pr-8">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REVERSED">Reversed</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input h-9 w-auto text-[13px] pr-8">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {message && (
        <div className="px-3 py-2 text-[13px] font-medium border-b" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          {message}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">Reference</th>
              <th className="th">Date</th>
              <th className="th">From → To</th>
              <th className="th">Category</th>
              <th className="th text-right">Amount</th>
              <th className="th">Status</th>
              {canReverse && <th className="th"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="td text-[var(--ink-3)]" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="td" colSpan={7}>
                  <EmptyState title="No transactions" body="Payments, allocations and reversals will appear here." />
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="td">
                    <div className="font-medium text-[13px]">{r.reference}</div>
                    <div className="text-[11.5px] text-[var(--ink-3)]">{TYPE_LABELS[r.type] ?? r.type}</div>
                  </td>
                  <td className="td text-[13px] text-[var(--ink-2)] whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    <div className="text-[11.5px] text-[var(--ink-3)]">
                      {new Date(r.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="td text-[13px]">
                    <div>{r.senderLabel ?? "—"}</div>
                    <div className="text-[var(--ink-3)]">→ {r.recipientLabel ?? "—"}</div>
                  </td>
                  <td className="td text-[13px]">
                    {r.category ?? "—"}
                    {r.purpose ? <div className="text-[11.5px] text-[var(--ink-3)]">{r.purpose}</div> : null}
                  </td>
                  <td className={`td text-right font-semibold tabular ${r.type === "REVERSAL" || r.type === "ALLOCATION" ? "text-[var(--ok)]" : ""}`}>
                    {r.type === "PAYMENT" ? "-" : r.type === "REVERSAL" ? "+" : ""}
                    {formatBirr(BigInt(r.amount))}
                  </td>
                  <td className="td">
                    <StatusBadge status={r.status} />
                  </td>
                  {canReverse && (
                    <td className="td text-right">
                      {r.status === "COMPLETED" && r.type === "PAYMENT" ? (
                        <button
                          onClick={() => reverse(r.id)}
                          disabled={reversing === r.id}
                          className="text-[12px] font-semibold px-2 py-1 rounded"
                          style={{ color: "var(--danger)", background: "var(--danger-soft)" }}
                        >
                          {reversing === r.id ? "…" : "Reverse"}
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
