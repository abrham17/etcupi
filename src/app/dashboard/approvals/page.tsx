"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBirr } from "@/lib/money";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

interface Approval {
  id: string;
  txId: string;
  reference: string;
  amount: string;
  purpose: string | null;
  category: string | null;
  employeeName: string;
  merchantName: string | null;
  createdAt: string;
  status: string;
  approverRole: string | null;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDecided, setShowDecided] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const statusParam = showDecided ? "" : "PENDING";
    const res = await fetch(`/api/approvals${statusParam ? `?status=${statusParam}` : ""}`);
    const data = await res.json();
    setApprovals(data.approvals ?? []);
    setLoading(false);
  }, [showDecided]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("Reason for rejection (optional):") ?? undefined;
    }
    setBusy(id);
    const res = await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      setMessage(action === "approve" ? `Payment approved and completed. Ref ${data.reference}` : `Payment rejected. Ref ${data.reference}`);
      load();
    } else {
      setMessage(data.error ?? "Action failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        sub="Payments over your auto-approve threshold wait here until a decision is made."
        actions={
          <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--ink-2)] cursor-pointer select-none">
            <input type="checkbox" checked={showDecided} onChange={(e) => setShowDecided(e.target.checked)} />
            Show decided
          </label>
        }
      />

      {message && (
        <div className="mb-4 text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          {message}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="card card-pad text-[13px] text-[var(--ink-3)]">Loading…</div>
        ) : approvals.length === 0 ? (
          <div className="card">
            <EmptyState title="Nothing waiting for approval" body="Payments that exceed the auto-approve threshold will appear here." />
          </div>
        ) : (
          approvals.map((a) => (
            <div key={a.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-bold tabular">{formatBirr(BigInt(a.amount))} ETB</span>
                    <StatusBadge status={a.status} />
                    {a.approverRole && (
                      <span className="badge-neutral">Needs {a.approverRole === "COMPANY_ADMIN" ? "Company Admin" : "Finance Manager"}</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[13.5px]">
                    <span className="font-semibold">{a.employeeName}</span>
                    <span className="text-[var(--ink-3)]"> → </span>
                    <span className="font-semibold">{a.merchantName}</span>
                  </div>
                  <div className="text-[12.5px] text-[var(--ink-2)] mt-0.5">
                    {a.purpose} · {a.category} · <span className="tabular">{a.reference}</span>
                  </div>
                </div>
                {a.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(a.id, "reject")}
                      disabled={busy === a.id}
                      className="btn-secondary"
                      style={{ color: "var(--danger)" }}
                    >
                      Reject
                    </button>
                    <button onClick={() => decide(a.id, "approve")} disabled={busy === a.id} className="btn-primary">
                      {busy === a.id ? "…" : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
