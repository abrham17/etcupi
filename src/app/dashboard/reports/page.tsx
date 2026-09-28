"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { PageHeader } from "@/components/ui";
import { formatBirr } from "@/lib/money";

interface ReportData {
  companyBalance: string;
  monthSpent: string;
  pendingCount: number;
  employees: number;
  byCategory: { category: string; total: string }[];
  daily: { day: string; total: string }[];
  monthly: { month: string; total: string }[];
  byEmployee: { name: string; total: string }[];
}

const PIE_COLORS = ["#0e6b3d", "#b8860b", "#4a5a52", "#7a877f", "#1a7f4e", "#9a6b00", "#cdd2ca", "#06381f"];

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setData(d));
  }, []);

  if (!data) return <div className="text-[13px] text-[var(--ink-3)]">Loading reports…</div>;

  const byCategory = data.byCategory.map((c) => ({ name: c.category, value: Number(c.total) / 100 }));
  const daily = data.daily.map((d) => ({
    day: new Date(d.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    total: Number(d.total) / 100,
  }));
  const monthly = data.monthly.map((m) => ({
    month: new Date(m.month).toLocaleDateString("en-GB", { month: "short" }),
    total: Number(m.total) / 100,
  }));
  const byEmployee = data.byEmployee.map((e) => ({ name: e.name, total: Number(e.total) / 100 }));

  return (
    <div>
      <PageHeader title="Reports" sub="Spending analytics derived from the transaction ledger." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Corporate balance", v: `${formatBirr(BigInt(data.companyBalance))} ETB` },
          { label: "Spent this month", v: `${formatBirr(BigInt(data.monthSpent))} ETB` },
          { label: "Pending payments", v: String(data.pendingCount) },
          { label: "Employees", v: String(data.employees) },
        ].map((s) => (
          <div key={s.label} className="card card-pad">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">{s.label}</div>
            <div className="mt-1 text-[22px] font-bold tabular">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h2 className="font-bold text-[15px] mb-4">Spending over time (daily)</h2>
          {daily.length === 0 ? (
            <div className="text-[13px] text-[var(--ink-3)] py-8 text-center">No payments this month yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ETB`, "Spent"]} />
                <Line type="monotone" dataKey="total" stroke="#0e6b3d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="font-bold text-[15px] mb-4">Spending by category</h2>
          {byCategory.length === 0 ? (
            <div className="text-[13px] text-[var(--ink-3)] py-8 text-center">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString()} ETB`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="font-bold text-[15px] mb-4">Spending by employee</h2>
          {byEmployee.length === 0 ? (
            <div className="text-[13px] text-[var(--ink-3)] py-8 text-center">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byEmployee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ETB`, "Spent"]} />
                <Bar dataKey="total" fill="#0e6b3d" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="font-bold text-[15px] mb-4">Monthly spending trend</h2>
          {monthly.length === 0 ? (
            <div className="text-[13px] text-[var(--ink-3)] py-8 text-center">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ETB`, "Spent"]} />
                <Bar dataKey="total" fill="#b8860b" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
