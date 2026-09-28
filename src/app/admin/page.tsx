"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatBirr } from "@/lib/money";

interface Company {
  id: string;
  name: string;
  businessType: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  balance: string;
  employees: number;
  members: number;
  createdAt: string;
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setCompanies(data.companies ?? []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function toggleStatus(c: Company) {
    const next = c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!window.confirm(`${next === "SUSPENDED" ? "Suspend" : "Activate"} ${c.name}?`)) return;
    const res = await fetch(`/api/companies/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setMessage(`${c.name} ${next === "SUSPENDED" ? "suspended" : "activated"}`);
      load();
    }
  }

  return (
    <div>
      <PageHeader title="Companies" sub="All registered companies on the platform." />
      {message && (
        <div className="mb-4 text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          {message}
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="input max-w-md mb-4" />
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="th">Company</th>
                <th className="th text-right">Corporate balance</th>
                <th className="th text-right">Employees</th>
                <th className="th">Since</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="td text-[var(--ink-3)]" colSpan={6}>Loading…</td></tr>
              ) : companies.length === 0 ? (
                <tr><td className="td" colSpan={6}><EmptyState title="No companies" /></td></tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="td">
                      <div className="font-semibold text-[13.5px]">{c.name}</div>
                      <div className="text-[12px] text-[var(--ink-3)]">{c.businessType} · {c.email}</div>
                    </td>
                    <td className="td text-right font-semibold tabular">{formatBirr(BigInt(c.balance))} ETB</td>
                    <td className="td text-right text-[13px]">{c.employees}</td>
                    <td className="td text-[12.5px] text-[var(--ink-2)] whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </td>
                    <td className="td"><StatusBadge status={c.status} /></td>
                    <td className="td text-right">
                      <button
                        onClick={() => toggleStatus(c)}
                        className="text-[12px] font-semibold px-2 py-1 rounded"
                        style={c.status === "ACTIVE" ? { color: "var(--danger)", background: "var(--danger-soft)" } : { color: "var(--ok)", background: "var(--ok-soft)" }}
                      >
                        {c.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
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
