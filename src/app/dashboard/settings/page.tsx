"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { formatBirr } from "@/lib/money";

interface Company {
  name: string;
  businessType: string;
  phone: string;
  email: string;
  address: string | null;
  city: string;
  subCity: string | null;
  description: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  actor: { fullName: string } | null;
  metadata: Record<string, unknown> | null;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"profile" | "audit">("profile");
  const [company, setCompany] = useState<Company | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [topup, setTopup] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => setBalance(d.balance ?? "0"));
    // Company profile via /api/companies PATCH needs GET; reuse wallet + settings fetch:
    fetch("/api/notifications").catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "audit") {
      fetch("/api/audit?take=60")
        .then((r) => r.json())
        .then((d) => setAuditRows(d.logs ?? []));
    }
  }, [tab]);

  async function loadCompany() {
    // GET company profile is exposed via /api/companies (super admin only), so we
    // fetch the company through the wallet endpoint + employee payload instead.
    const res = await fetch("/api/company-profile");
    if (res.ok) {
      const d = await res.json();
      setCompany(d.company);
      setBalance(d.balance ?? "0");
    }
  }

  useEffect(() => {
    loadCompany();
  }, []);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        businessType: fd.get("businessType"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        address: fd.get("address"),
        city: fd.get("city"),
        subCity: fd.get("subCity"),
        description: fd.get("description"),
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Profile updated ✓" : (data.error ?? "Update failed"));
  }

  async function doTopup(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: topup }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Wallet funded. Ref ${data.reference}`);
      setTopup("");
      loadCompany();
    } else {
      setMessage(data.error ?? "Top-up failed");
    }
  }

  return (
    <div>
      <PageHeader title="Settings" sub="Company profile, corporate wallet funding and audit trail." />

      <div className="flex gap-2 mb-4">
        {(["profile", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 h-9 rounded-md text-[13px] font-semibold"
            style={tab === t ? { background: "var(--brand)", color: "#fff" } : { background: "#eef0ec", color: "var(--ink-2)" }}
          >
            {t === "profile" ? "Company profile" : "Audit log"}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-4 text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          {message}
        </div>
      )}

      {tab === "profile" && company && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={saveProfile} className="card card-pad space-y-3">
            <div className="font-bold text-[14px]">Company profile</div>
            <div>
              <label className="label">Name</label>
              <input name="name" defaultValue={company.name} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Business type</label>
                <input name="businessType" defaultValue={company.businessType} className="input" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input name="phone" defaultValue={company.phone} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" defaultValue={company.email} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">City</label>
                <input name="city" defaultValue={company.city} className="input" />
              </div>
              <div>
                <label className="label">Sub-city</label>
                <input name="subCity" defaultValue={company.subCity ?? ""} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input name="address" defaultValue={company.address ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" defaultValue={company.description ?? ""} className="input h-20 py-2" rows={2} />
            </div>
            <button className="btn-primary">Save profile</button>
          </form>

          <div className="space-y-4">
            <div className="card card-pad">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">Corporate wallet</div>
              <div className="mt-1 text-[30px] font-black tabular" style={{ color: "var(--brand-ink)" }}>
                {formatBirr(BigInt(balance))} <span className="text-[16px] font-bold text-[var(--ink-3)]">ETB</span>
              </div>
              <form onSubmit={doTopup} className="mt-4 flex gap-2">
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={topup}
                  onChange={(e) => setTopup(e.target.value)}
                  placeholder="Amount in ETB (simulated funding)"
                  className="input flex-1"
                />
                <button className="btn-primary">Fund wallet</button>
              </form>
              <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                Simulated funding: credits the corporate wallet through the internal ledger (max 1,000,000 ETB per top-up).
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "profile" && !company && <div className="text-[13px] text-[var(--ink-3)]">Loading…</div>}

      {tab === "audit" && (
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
                {auditRows.length === 0 ? (
                  <tr><td className="td text-[var(--ink-3)]" colSpan={5}>No audit events yet</td></tr>
                ) : (
                  auditRows.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="td text-[12.5px] text-[var(--ink-2)] whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="td text-[13px]">{r.actor?.fullName ?? "System"}</td>
                      <td className="td">
                        <span className="badge-neutral">{r.action.replaceAll("_", " ")}</span>
                      </td>
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
      )}
    </div>
  );
}
