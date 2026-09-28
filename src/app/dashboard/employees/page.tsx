"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBirr } from "@/lib/money";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  title: string | null;
  department: string | null;
  employeeCode: string;
  paymentId: string;
  balance: string;
  monthlyLimit: string;
  dailyLimit: string;
  txLimit: string;
}

const emptyForm = { fullName: "", email: "", phone: "", department: "", title: "", monthlyLimit: "10000", dailyLimit: "2000", txLimit: "1000" };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [allocating, setAllocating] = useState<Employee | null>(null);
  const [allocAmount, setAllocAmount] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data.employees ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        monthlyLimit: Number(form.monthlyLimit),
        dailyLimit: Number(form.dailyLimit),
        txLimit: Number(form.txLimit),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create employee");
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    setMessage(`Employee created. Temporary password: ${form.fullName.toLowerCase().replace(/\s+/g, "")}123`);
    load();
  }

  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    if (!allocating) return;
    const res = await fetch("/api/wallet/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: allocating.id, amount: allocAmount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Allocation failed");
      return;
    }
    setMessage(`Allocated ${allocAmount} ETB to ${allocating.fullName}. Ref ${data.reference}`);
    setAllocating(null);
    setAllocAmount("");
    load();
  }

  async function toggleStatus(emp: Employee) {
    const action = emp.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!window.confirm(`${action === "SUSPENDED" ? "Suspend" : "Activate"} ${emp.fullName}?`)) return;
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    load();
  }

  async function saveLimits(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch(`/api/employees/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyLimit: Number(fd.get("monthlyLimit")),
        dailyLimit: Number(fd.get("dailyLimit")),
        txLimit: Number(fd.get("txLimit")),
        department: (fd.get("department") as string) || "",
        title: (fd.get("title") as string) || "",
      }),
    });
    if (res.ok) {
      setEditing(null);
      setMessage("Employee updated");
      load();
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        sub="Create staff accounts, assign limits and allocate budgets from the corporate wallet."
        actions={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            {showForm ? "Close" : "+ Add employee"}
          </button>
        }
      />

      {message && (
        <div className="mb-4 text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={createEmployee} className="card card-pad mb-4 grid md:grid-cols-3 gap-3">
          <div className="md:col-span-3 font-bold text-[14px]">New employee</div>
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Abebe Tesfaye" />
          </div>
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="abebe@company.et" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input required className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0911 234 567" />
          </div>
          <div>
            <label className="label">Department</label>
            <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Software Engineer" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Monthly</label>
              <input required type="number" min={0} className="input" value={form.monthlyLimit} onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })} />
            </div>
            <div>
              <label className="label">Daily</label>
              <input required type="number" min={0} className="input" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} />
            </div>
            <div>
              <label className="label">Per-tx</label>
              <input required type="number" min={0} className="input" value={form.txLimit} onChange={(e) => setForm({ ...form, txLimit: e.target.value })} />
            </div>
          </div>
          {error && <div className="md:col-span-3 text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>}
          <div className="md:col-span-3">
            <button className="btn-primary">Create employee</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="th">Employee</th>
                <th className="th">Payment ID</th>
                <th className="th">Department</th>
                <th className="th text-right">Wallet</th>
                <th className="th text-right">Monthly / Daily / Tx</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="td text-[var(--ink-3)]" colSpan={7}>Loading…</td></tr>
              ) : employees.length === 0 ? (
                <tr><td className="td" colSpan={7}><EmptyState title="No employees yet" body="Add your first employee to start allocating budgets." /></td></tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="table-row">
                    <td className="td">
                      <div className="font-semibold text-[13.5px]">{emp.fullName}</div>
                      <div className="text-[12px] text-[var(--ink-3)]">{emp.email}</div>
                    </td>
                    <td className="td text-[12.5px] tabular">{emp.paymentId}</td>
                    <td className="td text-[13px]">
                      {emp.department ?? "—"}
                      {emp.title ? <div className="text-[11.5px] text-[var(--ink-3)]">{emp.title}</div> : null}
                    </td>
                    <td className="td text-right font-semibold tabular">{formatBirr(BigInt(emp.balance))}</td>
                    <td className="td text-right text-[12.5px] tabular text-[var(--ink-2)]">
                      {formatBirr(BigInt(emp.monthlyLimit))} / {formatBirr(BigInt(emp.dailyLimit))} / {formatBirr(BigInt(emp.txLimit))}
                    </td>
                    <td className="td"><StatusBadge status={emp.status} /></td>
                    <td className="td">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => { setAllocating(emp); setAllocAmount(""); }}
                          className="text-[12px] font-semibold px-2 py-1 rounded"
                          style={{ color: "var(--brand)", background: "var(--brand-soft)" }}
                        >
                          Allocate
                        </button>
                        <button
                          onClick={() => setEditing(emp)}
                          className="text-[12px] font-semibold px-2 py-1 rounded"
                          style={{ color: "var(--ink-2)", background: "#eef0ec" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(emp)}
                          className="text-[12px] font-semibold px-2 py-1 rounded"
                          style={emp.status === "ACTIVE" ? { color: "var(--danger)", background: "var(--danger-soft)" } : { color: "var(--ok)", background: "var(--ok-soft)" }}
                        >
                          {emp.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocate modal */}
      {allocating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(10,20,15,0.45)" }}>
          <form onSubmit={allocate} className="card card-pad w-full max-w-sm">
            <div className="font-bold text-[16px] mb-1">Allocate budget</div>
            <div className="text-[13px] text-[var(--ink-2)] mb-4">
              To {allocating.fullName} · wallet {formatBirr(BigInt(allocating.balance))} ETB
            </div>
            <label className="label">Amount (ETB)</label>
            <input required autoFocus type="number" min={1} step="0.01" className="input" value={allocAmount} onChange={(e) => setAllocAmount(e.target.value)} placeholder="5000" />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setAllocating(null)} className="btn-secondary flex-1">Cancel</button>
              <button className="btn-primary flex-1">Allocate</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(10,20,15,0.45)" }}>
          <form onSubmit={saveLimits} className="card card-pad w-full max-w-sm">
            <div className="font-bold text-[16px] mb-4">Edit {editing.fullName}</div>
            <div className="space-y-3">
              <div>
                <label className="label">Monthly limit (ETB)</label>
                <input name="monthlyLimit" type="number" min={0} defaultValue={Number(editing.monthlyLimit) / 100} className="input" />
              </div>
              <div>
                <label className="label">Daily limit (ETB)</label>
                <input name="dailyLimit" type="number" min={0} defaultValue={Number(editing.dailyLimit) / 100} className="input" />
              </div>
              <div>
                <label className="label">Single-transaction limit (ETB)</label>
                <input name="txLimit" type="number" min={0} defaultValue={Number(editing.txLimit) / 100} className="input" />
              </div>
              <div>
                <label className="label">Department</label>
                <input name="department" defaultValue={editing.department ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Title</label>
                <input name="title" defaultValue={editing.title ?? ""} className="input" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
              <button className="btn-primary flex-1">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
