"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  actor: { fullName: string } | null;
  metadata: Record<string, unknown> | null;
}

export default function SystemPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    fetch("/api/audit?take=120")
      .then((r) => r.json())
      .then((d) => setRows(d.logs ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="System" sub="Platform audit trail and payment-rail configuration." />

      <div className="card card-pad mb-4">
        <div className="font-bold text-[14px] mb-1">Payment rail</div>
        <div className="text-[13px] text-[var(--ink-2)]">
          Active rail: <span className="font-semibold">internal (simulated)</span> — payments settle inside the platform's
          double-entry ledger. Telebirr / bank rails can be plugged into the same <code className="text-[12px]">PaymentRail</code> interface
          without UI or business-logic changes.
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="th">Time</th>
                <th className="th">Actor</th>
                <th className="th">Action</th>
                <th className="th">Entity</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="td text-[var(--ink-3)]" colSpan={5}>No audit events yet</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="td text-[12.5px] text-[var(--ink-2)] whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="td text-[13px]">{r.actor?.fullName ?? "System"}</td>
                    <td className="td"><span className="badge-neutral">{r.action.replaceAll("_", " ")}</span></td>
                    <td className="td text-[13px]">{r.entity}</td>
                    <td className="td text-[12px] text-[var(--ink-3)] max-w-[280px] truncate">
                      {r.metadata ? JSON.stringify(r.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
